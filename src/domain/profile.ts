import { NEEDS_BAR_IDS } from '../data/curated'

export type Goal ='hipertrofia' | 'forca'
export type Split = 'AB' | 'ABC' | 'ABCD' | 'upper_lower' | 'full_body'
export type EquipmentAccess = 'academia' | 'halteres' | 'peso_corporal'
export type Level = 'iniciante' | 'intermediario' | 'avancado'

export interface Profile {
  goal: Goal
  daysPerWeek: number // 2–6
  split: Split
  equipment: EquipmentAccess
  level: Level
  /** Tem barra fixa/paralelas? Ausente = padrão da opção de equipamento. */
  pullupBar?: boolean
}

export const DEFAULT_PULLUP_BAR: Record<EquipmentAccess, boolean> = {
  academia: true,
  halteres: false,
  peso_corporal: true,
}

export const hasPullupBar = (p: Profile) => p.pullupBar ?? DEFAULT_PULLUP_BAR[p.equipment]

/** O exercício `id` (com equipamento `equipment` no dataset) é viável para o perfil? */
export function isAvailable(p: Profile, id: string, equipment: string | undefined): boolean {
  if (equipment === undefined || !EQUIPMENT_SETS[p.equipment].has(equipment)) return false
  return hasPullupBar(p) || !NEEDS_BAR_IDS.has(id)
}

export const GOAL_PT: Record<Goal, string> = { hipertrofia: 'Hipertrofia', forca: 'Força' }

export const SPLIT_PT: Record<Split, string> = {
  AB: 'AB',
  ABC: 'ABC',
  ABCD: 'ABCD',
  upper_lower: 'Superior / Inferior',
  full_body: 'Full body',
}

export const SPLIT_HINT: Record<Split, string> = {
  AB: 'A: empurrar + quadríceps · B: puxar + posteriores',
  ABC: 'A: peito/ombro/tríceps · B: costas/bíceps · C: pernas',
  ABCD: 'A: peito/tríceps · B: costas/bíceps · C: pernas · D: ombros/abdômen',
  upper_lower: 'Alterna membros superiores e inferiores',
  full_body: 'Corpo inteiro em todo treino',
}

export const EQUIPMENT_ACCESS_PT: Record<EquipmentAccess, string> = {
  academia: 'Academia completa',
  halteres: 'Só halteres',
  peso_corporal: 'Peso corporal',
}

export const LEVEL_PT: Record<Level, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

/** Valores de `equipment` do dataset liberados por opção de acesso. */
export const EQUIPMENT_SETS: Record<EquipmentAccess, ReadonlySet<string>> = {
  academia: new Set([
    'barbell',
    'dumbbell',
    'cable',
    'leverage machine',
    'smith machine',
    'sled machine',
    'ez barbell',
    'trap bar',
    'olympic barbell',
    'body weight',
    'weighted',
    'assisted',
    'kettlebell',
    'wheel roller',
  ]),
  halteres: new Set(['dumbbell', 'body weight']),
  peso_corporal: new Set(['body weight']),
}

/** Quantos dias distintos (letras) cada divisão tem. */
export const SPLIT_DAY_KEYS: Record<Split, string[]> = {
  AB: ['A', 'B'],
  ABC: ['A', 'B', 'C'],
  ABCD: ['A', 'B', 'C', 'D'],
  upper_lower: ['S', 'I'],
  full_body: ['1', '2', '3'],
}

/** Divisão recomendada por frequência (sugestão no onboarding). */
export function recommendedSplit(days: number): Split {
  if (days <= 3) return days === 2 ? 'full_body' : 'ABC'
  if (days === 4) return 'upper_lower'
  return days === 5 ? 'ABCD' : 'ABC'
}
