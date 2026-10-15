import type { Split } from '../../domain/profile'
import type { GoalId, GoalProfile } from '../types'
import { FORCA } from './forca'
import { GASTO_ENERGETICO } from './gasto_energetico'
import { HIPERTROFIA } from './hipertrofia'
import { POWERBUILDING } from './powerbuilding'
import { RESISTENCIA } from './resistencia'

export const GOALS: Record<GoalId, GoalProfile> = {
  forca: FORCA,
  hipertrofia: HIPERTROFIA,
  gasto_energetico: GASTO_ENERGETICO,
  resistencia: RESISTENCIA,
  powerbuilding: POWERBUILDING,
}

/** Divisão recomendada considerando objetivo (regras do GoalProfile) e frequência. */
export function recommendedSplitFor(goal: GoalId, days: number, fallback: (days: number) => Split): Split {
  const rule = GOALS[goal].dayStructureRules?.find(
    (r) => r.split && (!r.when.daysPerWeek || (days >= r.when.daysPerWeek.min && days <= r.when.daysPerWeek.max)),
  )
  return rule?.split ?? fallback(days)
}
