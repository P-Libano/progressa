import { CURATED_BY_ID, type CuratedExercise } from '../data/curated'
import type { Profile } from '../domain/profile'
import { findUnfoundedClaims } from '../lib/claims'
import { effectiveProfile, type EquipmentLookup } from '../programacao/generator'
import { META_BY_ID } from '../programacao/meta'
import { programFromDays, type PlainDay } from '../programacao/program'
import type { Program } from '../programacao/types'
import { dayKeysFor, programExerciseIds } from './context'
import { aiReviewSchema, aiRoutineSchema, type AiReview } from './schemas'

/** Erro com mensagem pronta para mostrar ao usuário. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'chave' | 'rede' | 'limite' | 'recusa' | 'invalido' | 'api' = 'api',
  ) {
    super(message)
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new AiError('A IA respondeu em um formato que não é JSON. Tente de novo.', 'invalido')
  }
}

function zodMessage(issue: { path: PropertyKey[]; message: string }) {
  return `"${issue.path.map(String).join('.') || 'raiz'}": ${issue.message}`
}

const LARGE: [string, string[]][] = [
  ['peito', ['peito']],
  ['costas', ['costas']],
  ['pernas', ['quadriceps', 'posteriores', 'gluteos']],
  ['ombros', ['ombros']],
]

/**
 * Valida a rotina devolvida pela IA e converte para o modelo do app.
 * Rejeita (AiError) o que quebraria o app; avisa (warnings) o que é só discutível.
 */
export function parseAiRoutine(
  text: string,
  input: Profile,
  allowed: ReadonlyMap<string, CuratedExercise>,
  equipmentOf: EquipmentLookup,
  now = Date.now(),
): Program {
  const parsed = aiRoutineSchema.safeParse(parseJson(text))
  if (!parsed.success) {
    throw new AiError(`A rotina da IA veio fora do formato esperado em ${zodMessage(parsed.error.issues[0])}.`, 'invalido')
  }
  const ai = parsed.data
  const profile = effectiveProfile(input)
  const keys = dayKeysFor(profile)
  const problems: string[] = []
  const warnings: string[] = []

  if (ai.days.length !== keys.length) {
    problems.push(`veio com ${ai.days.length} dia(s), esperado ${keys.length} (${keys.join(', ')})`)
  }

  const days: PlainDay[] = ai.days.slice(0, keys.length).map((d, i) => {
    const key = keys[i] // a chave é do app, não da IA
    const label = `Treino ${key}`
    if (d.exercises.length < 4 || d.exercises.length > 6) problems.push(`${label} tem ${d.exercises.length} exercícios (precisa de 4 a 6)`)
    const seen = new Set<string>()
    const exercises = d.exercises.map((e, j) => {
      const cur = allowed.get(e.exerciseId)
      if (!cur) problems.push(`${label}: exercício "${e.exerciseId}" não está na lista permitida`)
      if (seen.has(e.exerciseId)) problems.push(`${label}: exercício "${e.exerciseId}" repetido`)
      seen.add(e.exerciseId)
      if (e.sets < 1 || e.sets > 6) problems.push(`${label}: ${e.sets} séries no exercício ${j + 1} (1 a 6)`)
      if (e.repMin < 1 || e.repMax > 30 || e.repMin > e.repMax) problems.push(`${label}: faixa ${e.repMin}–${e.repMax} reps inválida`)
      if (e.restSec < 30 || e.restSec > 300) problems.push(`${label}: descanso de ${e.restSec}s fora de 30–300s`)
      if (e.repMin < 6 && META_BY_ID.get(e.exerciseId) && !META_BY_ID.get(e.exerciseId)!.adequadoBaixasReps) {
        warnings.push(`${label}: ${cur?.pt ?? e.exerciseId} não serve para menos de 6 reps; ajustei a faixa.`)
      }
      return { ...e, compound: cur?.compound ?? CURATED_BY_ID.get(e.exerciseId)?.compound ?? false }
    })
    const ordered = exercises
      .map((e, idx) => ({ e, idx }))
      .sort((a, b) => Number(b.e.compound) - Number(a.e.compound) || a.idx - b.idx)
      .map(({ e }) => e)
    if (ordered.some((e, idx) => e !== exercises[idx])) warnings.push(`${label}: reordenei para compostos virem antes dos isoladores.`)
    const name = d.name.trim().slice(0, 60) || 'Treino'
    return { key, name, exercises: ordered.map(({ compound: _c, ...rest }) => rest) }
  })

  if (problems.length) {
    const more = problems.length > 3 ? ` (e mais ${problems.length - 3})` : ''
    throw new AiError(`A rotina da IA não passou na validação: ${problems.slice(0, 3).join('; ')}${more}.`, 'invalido')
  }

  const trained = new Set(days.flatMap((d) => d.exercises.map((e) => CURATED_BY_ID.get(e.exerciseId)?.group)))
  for (const [label, groups] of LARGE) {
    if (!groups.some((g) => trained.has(g as never))) warnings.push(`A rotina da IA não inclui ${label}.`)
  }

  let notes = ai.notes.trim()
  if (findUnfoundedClaims(notes).length) {
    warnings.push('A explicação da IA continha uma promessa sem base e foi descartada.')
    notes = ''
  }

  return programFromDays(profile, days, equipmentOf, { source: 'ia', notes: notes || undefined, warnings, now })
}

/** Valida a revisão semanal: ids precisam existir na rotina / nas alternativas. */
export function parseAiReview(text: string, program: Program, alternatives: ReadonlyMap<string, CuratedExercise>): AiReview {
  const parsed = aiReviewSchema.safeParse(parseJson(text))
  if (!parsed.success) {
    throw new AiError(`A revisão da IA veio fora do formato esperado em ${zodMessage(parsed.error.issues[0])}.`, 'invalido')
  }
  const inRoutine = programExerciseIds(program)
  // descarta itens que apontam para ids inexistentes em vez de rejeitar a revisão inteira
  const adjustments = parsed.data.adjustments
    .filter((a) => inRoutine.has(a.exerciseId))
    .map((a) =>
      a.action === 'trocar_exercicio' && (!a.replacementId || !alternatives.has(a.replacementId))
        ? { ...a, replacementId: null }
        : a,
    )
  return { summary: parsed.data.summary.trim(), adjustments }
}
