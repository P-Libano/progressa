import type { CuratedExercise } from '../data/curated'
import type { Profile } from '../domain/profile'
import type { Session } from '../domain/session'
import type { Program } from '../programacao/types'
import { anthropicTransport, type AiTransport } from './client'
import { REVIEW_SYSTEM, ROUTINE_SYSTEM, availableExercises, programExerciseIds, reviewPrompt, routinePrompt } from './context'
import { aiReviewSchema, aiRoutineSchema, type AiReview } from './schemas'
import { AiError, parseAiReview, parseAiRoutine } from './validate'

export { AiError } from './validate'
export type { AiReview } from './schemas'

interface Deps {
  apiKey: string | undefined
  equipmentOf: (id: string) => string | undefined
  transport?: AiTransport
}

const requireKey = (k: string | undefined) => {
  if (!k?.trim()) throw new AiError('Configure sua chave da Claude API em Ajustes para usar a IA.', 'chave')
  return k.trim()
}

/** "Gerar rotina com IA": perfil + lista resumida de exercícios → programa validado (não ativado). */
export async function generateRoutineWithAI(profile: Profile, deps: Deps): Promise<Program> {
  const key = requireKey(deps.apiKey)
  const list = availableExercises(profile, deps.equipmentOf)
  const res = await (deps.transport ?? anthropicTransport)(key, {
    system: ROUTINE_SYSTEM,
    prompt: routinePrompt(profile, list, deps.equipmentOf),
    schema: aiRoutineSchema,
  })
  return parseAiRoutine(res.text, profile, new Map(list.map((c) => [c.id, c])), deps.equipmentOf)
}

/** "Revisar semana": histórico de 14 dias + programa → resumo e ajustes. */
export async function reviewWeekWithAI(
  program: Program,
  sessions: Session[],
  nameOf: (id: string) => string,
  deps: Deps,
): Promise<AiReview & { alternatives: ReadonlyMap<string, CuratedExercise> }> {
  const key = requireKey(deps.apiKey)
  const inProgram = programExerciseIds(program)
  const alternatives = availableExercises(program.profile, deps.equipmentOf).filter((c) => !inProgram.has(c.id))
  const altMap = new Map(alternatives.map((c) => [c.id, c]))
  const res = await (deps.transport ?? anthropicTransport)(key, {
    system: REVIEW_SYSTEM,
    prompt: reviewPrompt(program, sessions, nameOf, alternatives),
    schema: aiReviewSchema,
    maxTokens: 8000,
  })
  return { ...parseAiReview(res.text, program, altMap), alternatives: altMap }
}
