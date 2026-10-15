import type { MuscleGroup } from '../data/curated'
import type { EquipmentLookup } from './generator'
import { programFromDays } from './program'
import type { ExercisePrescription, ExerciseResultV2, Program, SessionV2, SuggestionKind, UserProfile } from './types'

/**
 * Migração do modelo v1 (Routine + sessões sem RPE) para v2 (Program + SessionV2).
 * Usada pelo upgrade do IndexedDB (Dexie v4) e pelo import de backup formato 1.
 */

export interface RoutineV1 {
  id?: number
  createdAt: number
  source: 'local' | 'ia'
  profile: UserProfile
  days: {
    key: string
    name: string
    exercises: { exerciseId: string; group: MuscleGroup; compound: boolean; sets: number; repMin: number; repMax: number; restSec: number }[]
  }[]
  schedule: string[]
  warnings: string[]
  notes?: string
}

interface ResultV1 {
  date: number
  sets: { weight: number; reps: number }[]
}

export interface SessionV1 {
  id?: number
  routineId: number
  dayKey: string
  dayName: string
  startedAt: number
  finishedAt?: number
  status: 'active' | 'done'
  exerciseIds: string[]
  exercises: {
    exerciseId: string
    group: MuscleGroup
    compound: boolean
    sets: number
    repMin: number
    repMax: number
    restSec: number
    suggestion: { kind: string; weight: number | null; failStreak: number; reason: string }
    previous?: ResultV1
    recent?: ResultV1[]
    log: { weight: number | null; reps: number | null; done: boolean }[]
  }[]
  restUntil?: number
  restTotal?: number
}

/** Chave v2 para a chave v1: letras ganham o nº da ocorrência; full body "1/2/3" vira "F1/F2/F3". */
export const keyV2 = (k: string, occurrence = 1) => (/^\d+$/.test(k) ? `F${k}` : `${k}${occurrence}`)

export function migrateRoutine(r: RoutineV1, equipmentOf: EquipmentLookup): Program {
  const seen = new Map<string, number>()
  const byKey = new Map(r.days.map((d) => [d.key, d]))
  const schedule = r.schedule.length ? r.schedule : r.days.map((d) => d.key)
  const weekDays = schedule
    .filter((k) => byKey.has(k))
    .map((k) => {
      const occ = (seen.get(k) ?? 0) + 1
      seen.set(k, occ)
      const d = byKey.get(k)!
      return { key: keyV2(k, occ), name: d.name, exercises: d.exercises }
    })
  const profile: UserProfile = { ...r.profile }
  const p = programFromDays(profile, weekDays, equipmentOf, {
    source: r.source,
    notes: r.notes,
    singleWeek: true,
    warnings: r.warnings,
    now: r.createdAt,
  })
  return { ...p, ...(r.id !== undefined ? { id: r.id } : {}) }
}

const KINDS: ReadonlySet<string> = new Set<SuggestionKind>(['start', 'increase', 'keep', 'decrease', 'deload', 'less_rest', 'add_set', 'more_reps'])

export function migrateSession(s: SessionV1): SessionV2 {
  const exercises = s.exercises.map((e, i) => {
    const prescription: ExercisePrescription = {
      exerciseId: e.exerciseId,
      role: e.compound ? 'composto' : 'isolador',
      group: e.group,
      sets: e.sets,
      reps: { min: e.repMin, max: e.repMax },
      restSec: e.restSec,
    }
    const result = (r: ResultV1): ExerciseResultV2 => ({
      date: r.date,
      weekKind: 'carga',
      prescription,
      sets: r.sets.map((x) => ({ weight: x.weight, reps: x.reps, rpe: null, restBeforeSec: null })),
    })
    return {
      exerciseId: e.exerciseId,
      role: prescription.role,
      group: e.group,
      groupIndex: i,
      groupKind: 'simples' as const,
      prescription,
      suggestion: {
        kind: (KINDS.has(e.suggestion.kind) ? e.suggestion.kind : 'keep') as SuggestionKind,
        weight: e.suggestion.weight,
        failStreak: e.suggestion.failStreak,
        reason: e.suggestion.reason,
      },
      ...(e.previous ? { previous: result(e.previous) } : {}),
      ...(e.recent ? { recent: e.recent.map(result) } : {}),
      log: e.log.map((l) => ({ weight: l.weight, reps: l.reps, rpe: null, done: l.done })),
    }
  })
  return {
    ...(s.id !== undefined ? { id: s.id } : {}),
    programId: s.routineId,
    weekIndex: 1,
    weekKind: 'carga',
    dayKey: keyV2(s.dayKey),
    dayName: s.dayName,
    startedAt: s.startedAt,
    ...(s.finishedAt !== undefined ? { finishedAt: s.finishedAt, durationSec: Math.round((s.finishedAt - s.startedAt) / 1000) } : {}),
    status: s.status,
    exerciseIds: s.exerciseIds,
    exercises,
    ...(s.restUntil !== undefined ? { restUntil: s.restUntil, restTotal: s.restTotal } : {}),
  }
}
