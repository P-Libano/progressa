import type { MuscleGroup } from '../data/curated'
import type { Routine } from './generator'
import { suggestNext, type ExerciseResult, type Suggestion } from './progression'

export interface SetLog {
  weight: number | null
  reps: number | null
  done: boolean
}

export interface SessionExercise {
  exerciseId: string
  group: MuscleGroup
  compound: boolean
  sets: number
  repMin: number
  repMax: number
  restSec: number
  /** Sugestão calculada ao abrir a sessão (fica fixa durante o treino). */
  suggestion: Suggestion
  /** Séries da última vez que o exercício foi feito. */
  previous?: ExerciseResult
  /** Até 3 sessões anteriores (mais antiga primeiro), para o histórico ao lado. */
  recent?: ExerciseResult[]
  log: SetLog[]
}

export interface Session {
  id?: number
  routineId: number
  dayKey: string
  dayName: string
  startedAt: number
  finishedAt?: number
  status: 'active' | 'done'
  /** Índice multiEntry para buscar histórico por exercício. */
  exerciseIds: string[]
  exercises: SessionExercise[]
  /** Fim do descanso em andamento (epoch ms), sobrevive a recarregar a página. */
  restUntil?: number
  restTotal?: number
}

/** Séries concluídas de um exercício, no formato da progressão. */
export function toResult(e: SessionExercise, date: number): ExerciseResult {
  return {
    date,
    sets: e.log.filter((s) => s.done && s.reps !== null).map((s) => ({ weight: s.weight ?? 0, reps: s.reps! })),
  }
}

/** Histórico de um exercício a partir de sessões concluídas (ordem cronológica). */
export function historyFor(exerciseId: string, sessions: Session[]): ExerciseResult[] {
  return sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((s) => s.exercises.filter((e) => e.exerciseId === exerciseId).map((e) => toResult(e, s.startedAt)))
    .filter((r) => r.sets.length > 0)
}

/** Monta a sessão do dia já com sugestão de carga e séries pré-preenchidas. */
export function buildSession(routine: Routine, dayKey: string, past: Session[], now = Date.now()): Session {
  const day = routine.days.find((d) => d.key === dayKey)
  if (!day) throw new Error(`Dia ${dayKey} não existe na rotina`)
  const exercises = day.exercises.map((re): SessionExercise => {
    const history = historyFor(re.exerciseId, past)
    const suggestion = suggestNext(history, re, re.group)
    const previous = history[history.length - 1]
    const weight = suggestion.weight ?? previous?.sets[0]?.weight ?? null
    return {
      exerciseId: re.exerciseId,
      group: re.group,
      compound: re.compound,
      sets: re.sets,
      repMin: re.repMin,
      repMax: re.repMax,
      restSec: re.restSec,
      suggestion,
      previous,
      recent: history.slice(-3),
      log: Array.from({ length: re.sets }, () => ({ weight, reps: null, done: false })),
    }
  })
  return {
    routineId: routine.id!,
    dayKey,
    dayName: day.name,
    startedAt: now,
    status: 'active',
    exerciseIds: exercises.map((e) => e.exerciseId),
    exercises,
  }
}

/** Resumo para a tela de fim de treino. */
export function sessionSummary(s: Session) {
  const sets = s.exercises.flatMap((e) => e.log.filter((l) => l.done && l.reps !== null))
  return {
    exercises: s.exercises.filter((e) => e.log.some((l) => l.done)).length,
    sets: sets.length,
    reps: sets.reduce((a, l) => a + (l.reps ?? 0), 0),
    volumeKg: sets.reduce((a, l) => a + (l.reps ?? 0) * (l.weight ?? 0), 0),
    durationMin: Math.round(((s.finishedAt ?? Date.now()) - s.startedAt) / 60000),
  }
}

/** Aceita "62,5", "62.5", "" (→ null). */
export function parseNumber(input: string): number | null {
  const t = input.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
