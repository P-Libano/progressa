import type { MovementPattern, MuscleGroup } from '../data/curated'
import type { Split } from './types'

/**
 * Moldes de divisão: o que cada dia treina, como grupos em foco com movimentos em ordem
 * de preferência. Os slots do GoalProfile são preenchidos em rodízio por esses grupos.
 */

export interface Demand {
  /** Grupos (do catálogo) aceitos para este movimento. */
  groups: MuscleGroup[]
  patterns: MovementPattern[]
}

export interface Focus {
  /** Grupo contado no volume semanal. */
  group: MuscleGroup
  demands: Demand[]
}

export interface DayTemplate {
  letter: string
  name: string
  focus: Focus[]
  /** Índices (em `focus`) que podem receber o slot principal, em rodízio entre variantes do dia. */
  principalFocus: number[]
}

const d = (groups: MuscleGroup | MuscleGroup[], ...patterns: MovementPattern[]): Demand => ({
  groups: Array.isArray(groups) ? groups : [groups],
  patterns,
})

const PEITO: Focus = { group: 'peito', demands: [d('peito', 'empurrar_horizontal'), d('peito', 'empurrar_inclinado'), d('peito', 'crucifixo')] }
const COSTAS: Focus = { group: 'costas', demands: [d('costas', 'puxar_horizontal'), d('costas', 'puxar_vertical'), d('costas', 'pulldown_isolado')] }
const OMBROS: Focus = {
  group: 'ombros',
  demands: [d('ombros', 'empurrar_vertical'), d('ombros', 'elevacao_lateral'), d('ombros', 'deltoide_posterior'), d('ombros', 'elevacao_frontal')],
}
const OMBRO_POSTERIOR: Focus = { group: 'ombros', demands: [d('ombros', 'deltoide_posterior'), d('ombros', 'elevacao_lateral')] }
const BICEPS: Focus = { group: 'biceps', demands: [d('biceps', 'rosca')] }
const TRICEPS: Focus = { group: 'triceps', demands: [d('triceps', 'triceps_composto'), d('triceps', 'triceps_isolado')] }
const QUADRICEPS: Focus = { group: 'quadriceps', demands: [d('quadriceps', 'agachamento'), d('quadriceps', 'avanco'), d('quadriceps', 'extensora')] }
const POSTERIORES: Focus = { group: 'posteriores', demands: [d('posteriores', 'terra'), d('posteriores', 'flexora')] }
const GLUTEOS: Focus = { group: 'gluteos', demands: [d('gluteos', 'gluteo')] }
const PANTURRILHAS: Focus = { group: 'panturrilhas', demands: [d('panturrilhas', 'panturrilha')] }
const ABDOMEN: Focus = { group: 'abdomen', demands: [d('abdomen', 'abdominal')] }
const TRAPEZIO: Focus = { group: 'trapezio', demands: [d('trapezio', 'encolhimento')] }

const day = (letter: string, name: string, focus: Focus[], principalFocus: number[]): DayTemplate => ({ letter, name, focus, principalFocus })

export const SPLIT_TEMPLATES: Record<Split, DayTemplate[]> = {
  upper_lower: [
    day('S', 'Superiores', [PEITO, COSTAS, OMBROS, BICEPS, TRICEPS], [0, 2, 1]),
    // glúteo por último: o 2º composto pesado do dia deve ser outro agachamento/terra
    day('I', 'Inferiores', [QUADRICEPS, POSTERIORES, PANTURRILHAS, ABDOMEN, GLUTEOS], [0, 1]),
  ],
  AB: [
    day('A', 'Empurrar + quadríceps', [QUADRICEPS, PEITO, OMBROS, TRICEPS, PANTURRILHAS], [0, 1]),
    day('B', 'Puxar + posteriores', [POSTERIORES, COSTAS, BICEPS, GLUTEOS, OMBRO_POSTERIOR, ABDOMEN], [0, 1]),
  ],
  ABC: [
    day('A', 'Peito, ombros e tríceps', [PEITO, OMBROS, TRICEPS], [0, 1]),
    day('B', 'Costas e bíceps', [COSTAS, BICEPS, OMBRO_POSTERIOR], [0]),
    day('C', 'Pernas e abdômen', [QUADRICEPS, POSTERIORES, PANTURRILHAS, ABDOMEN, GLUTEOS], [0, 1]),
  ],
  ABCD: [
    day('A', 'Peito e tríceps', [PEITO, TRICEPS], [0]),
    day('B', 'Costas e bíceps', [COSTAS, BICEPS], [0]),
    day('C', 'Pernas', [QUADRICEPS, POSTERIORES, PANTURRILHAS, GLUTEOS], [0, 1]),
    day('D', 'Ombros e abdômen', [OMBROS, TRAPEZIO, ABDOMEN], [0]),
  ],
  full_body: [
    day('F', 'Full body', [QUADRICEPS, PEITO, COSTAS, POSTERIORES, OMBROS, BICEPS, TRICEPS, ABDOMEN, PANTURRILHAS], [0, 1, 3, 2]),
  ],
}

/** Grupos "grandes" usados nas checagens de volume. */
export const LARGE_GROUPS: MuscleGroup[] = ['peito', 'costas', 'quadriceps', 'posteriores', 'ombros']
