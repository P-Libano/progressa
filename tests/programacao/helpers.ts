import { loadFixtureCatalog } from '../../src/data/__fixtures__/load'
import type { MuscleGroup } from '../../src/data/curated'
import { compoundShareOf, generateProgram } from '../../src/programacao/generator'
import { META_BY_ID } from '../../src/programacao/meta'
import { allWeeks } from '../../src/programacao/program'
import type { ExercisePrescription, GoalId, Program, UserProfile, Week } from '../../src/programacao/types'

export const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))
export const equipmentOf = (id: string) => byId.get(id)?.equipment
export const nameOf = (id: string) => byId.get(id)?.namePt ?? byId.get(id)?.name ?? id

export const BASE = { daysPerWeek: 4, split: 'upper_lower', equipment: 'academia', level: 'intermediario' } as const
export const gen = (p: Partial<UserProfile> & { goal: GoalId }) => generateProgram({ ...BASE, ...p } as UserProfile, equipmentOf, 0)

export const firstLoadWeek = (p: Program): Week => allWeeks(p).find((w) => w.kind === 'carga')!
export const items = (w: Week) => w.days.flatMap((d) => d.groups.flatMap((g) => g.items))
export const strengthItems = (w: Week) => items(w).filter((i) => i.role !== 'condicionamento')

/** Os 5 compostos principais por padrão de movimento (agachamento, supino, terra, desenvolvimento, remada). */
export const MAIN_PATTERNS = new Set(['agachamento', 'empurrar_horizontal', 'terra', 'empurrar_vertical', 'puxar_horizontal'])
export const isMainLift = (i: ExercisePrescription) =>
  (i.role === 'principal' || i.role === 'composto') && MAIN_PATTERNS.has(META_BY_ID.get(i.exerciseId)?.pattern ?? '') && META_BY_ID.get(i.exerciseId)?.role === 'principal'

export function stats(p: Program) {
  const w = firstLoadWeek(p)
  const view = w.days.map((d) => ({ groups: d.groups, weight: 1 }))
  const si = strengthItems(w)
  const sets = si.reduce((a, i) => a + i.sets, 0)
  const avgRest = Math.round(si.reduce((a, i) => a + i.restSec * i.sets, 0) / sets)
  const finishers = w.days.filter((d) => d.groups.some((g) => g.kind === 'finisher')).length
  const grouped = w.days.flatMap((d) => d.groups).filter((g) => g.kind === 'superset' || g.kind === 'circuito').length
  return {
    sets,
    avgRest,
    compound: compoundShareOf(view, 'compostos'),
    compoundBig: compoundShareOf(view, 'compostos_grande_massa'),
    finishers,
    grouped,
    volume: p.weeklyVolume as Partial<Record<MuscleGroup, number>>,
  }
}

export const fmtR = (r?: { min: number; max: number }, unit = '') => (!r ? '—' : r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`)
