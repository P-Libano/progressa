import type { CuratedExercise } from '../data/curated'
import type { Routine } from '../domain/generator'
import type { Profile } from '../domain/profile'
import type { Session } from '../domain/session'
import { anthropicTransport, type AiTransport } from './client'
import { REVIEW_SYSTEM, ROUTINE_SYSTEM, availableExercises, reviewPrompt, routinePrompt } from './context'
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

/** "Gerar rotina com IA": perfil + lista resumida de exercícios → rotina validada (não ativada). */
export async function generateRoutineWithAI(profile: Profile, deps: Deps): Promise<Routine> {
  const key = requireKey(deps.apiKey)
  const list = availableExercises(profile, deps.equipmentOf)
  const res = await (deps.transport ?? anthropicTransport)(key, {
    system: ROUTINE_SYSTEM,
    prompt: routinePrompt(profile, list, deps.equipmentOf),
    schema: aiRoutineSchema,
  })
  return parseAiRoutine(res.text, profile, new Map(list.map((c) => [c.id, c])))
}

/** "Revisar semana": histórico de 14 dias + rotina → resumo e ajustes. */
export async function reviewWeekWithAI(
  routine: Routine,
  sessions: Session[],
  nameOf: (id: string) => string,
  deps: Deps,
): Promise<AiReview & { alternatives: ReadonlyMap<string, CuratedExercise> }> {
  const key = requireKey(deps.apiKey)
  const inRoutine = new Set(routine.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))
  const alternatives = availableExercises(routine.profile, deps.equipmentOf).filter((c) => !inRoutine.has(c.id))
  const altMap = new Map(alternatives.map((c) => [c.id, c]))
  const res = await (deps.transport ?? anthropicTransport)(key, {
    system: REVIEW_SYSTEM,
    prompt: reviewPrompt(routine, sessions, nameOf, alternatives),
    schema: aiReviewSchema,
    maxTokens: 8000,
  })
  return { ...parseAiReview(res.text, routine, altMap), alternatives: altMap }
}
