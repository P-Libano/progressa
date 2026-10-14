import { CURATED_BY_ID, type CuratedExercise } from '../data/curated'
import type { Routine, RoutineDay } from '../domain/generator'
import type { Profile } from '../domain/profile'
import { dayKeysFor } from './context'
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
export function parseAiRoutine(text: string, profile: Profile, allowed: ReadonlyMap<string, CuratedExercise>, now = Date.now()): Routine {
  const parsed = aiRoutineSchema.safeParse(parseJson(text))
  if (!parsed.success) {
    throw new AiError(`A rotina da IA veio fora do formato esperado em ${zodMessage(parsed.error.issues[0])}.`, 'invalido')
  }
  const ai = parsed.data
  const keys = dayKeysFor(profile)
  const problems: string[] = []
  const warnings: string[] = []

  if (ai.days.length !== keys.length) {
    problems.push(`veio com ${ai.days.length} dia(s), esperado ${keys.length} (${keys.join(', ')})`)
  }

  const days: RoutineDay[] = ai.days.slice(0, keys.length).map((d, i) => {
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
      return {
        exerciseId: e.exerciseId,
        group: cur?.group ?? CURATED_BY_ID.get(e.exerciseId)?.group ?? 'abdomen',
        compound: cur?.compound ?? false,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
        restSec: e.restSec,
      }
    })
    const ordered = exercises
      .map((e, idx) => ({ e, idx }))
      .sort((a, b) => Number(b.e.compound) - Number(a.e.compound) || a.idx - b.idx)
      .map(({ e }) => e)
    if (ordered.some((e, idx) => e !== exercises[idx])) warnings.push(`${label}: reordenei para compostos virem antes dos isoladores.`)
    const name = d.name.trim().slice(0, 60) || 'Treino'
    return { key, name: `${label} — ${name}`, exercises: ordered }
  })

  if (problems.length) {
    const more = problems.length > 3 ? ` (e mais ${problems.length - 3})` : ''
    throw new AiError(`A rotina da IA não passou na validação: ${problems.slice(0, 3).join('; ')}${more}.`, 'invalido')
  }

  const trained = new Set(days.flatMap((d) => d.exercises.map((e) => e.group)))
  for (const [label, groups] of LARGE) {
    if (!groups.some((g) => trained.has(g as never))) warnings.push(`A rotina da IA não inclui ${label}.`)
  }

  return {
    createdAt: now,
    source: 'ia',
    profile,
    days,
    schedule: Array.from({ length: profile.daysPerWeek }, (_, i) => keys[i % keys.length]),
    warnings,
    notes: ai.notes.trim(),
  }
}

/** Valida a revisão semanal: ids precisam existir na rotina / nas alternativas. */
export function parseAiReview(text: string, routine: Routine, alternatives: ReadonlyMap<string, CuratedExercise>): AiReview {
  const parsed = aiReviewSchema.safeParse(parseJson(text))
  if (!parsed.success) {
    throw new AiError(`A revisão da IA veio fora do formato esperado em ${zodMessage(parsed.error.issues[0])}.`, 'invalido')
  }
  const inRoutine = new Set(routine.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
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
