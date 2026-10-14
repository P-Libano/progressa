import type { Goal, Level } from './profile'

export interface Prescription {
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

type Table = Record<Goal, Record<Level, { compound: Prescription; isolation: Prescription }>>

const p = (sets: number, repMin: number, repMax: number, restSec: number): Prescription => ({
  sets,
  repMin,
  repMax,
  restSec,
})

/** Séries × reps por objetivo, nível e tipo de exercício. */
export const PRESCRIPTION: Table = {
  hipertrofia: {
    iniciante: { compound: p(3, 8, 12, 90), isolation: p(3, 8, 12, 60) },
    intermediario: { compound: p(4, 8, 12, 120), isolation: p(3, 10, 15, 75) },
    avancado: { compound: p(4, 6, 10, 150), isolation: p(4, 10, 15, 75) },
  },
  forca: {
    iniciante: { compound: p(3, 5, 8, 150), isolation: p(3, 8, 12, 75) },
    intermediario: { compound: p(4, 4, 6, 180), isolation: p(3, 8, 10, 90) },
    avancado: { compound: p(5, 3, 5, 240), isolation: p(3, 6, 10, 90) },
  },
}

/** Quantidade-alvo de exercícios por dia (sempre dentro de 4–6). */
export const EXERCISES_PER_DAY: Record<Level, number> = {
  iniciante: 5,
  intermediario: 5,
  avancado: 6,
}

export const prescribe = (goal: Goal, level: Level, compound: boolean): Prescription => ({
  ...PRESCRIPTION[goal][level][compound ? 'compound' : 'isolation'],
})
