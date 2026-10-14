import {
  ADVANCED_IDS,
  CURATED,
  CURATED_BY_ID,
  NEEDS_BAR_IDS,
  type CuratedExercise,
  type MovementPattern,
  type MuscleGroup,
} from '../data/curated'
import { EXERCISES_PER_DAY, prescribe } from './prescription'
import { SPLIT_DAY_KEYS, hasPullupBar, isAvailable, type Profile, type Split } from './profile'

export interface RoutineExercise {
  exerciseId: string
  /** Grupo que o slot da rotina pretende treinar. */
  group: MuscleGroup
  compound: boolean
  sets: number
  repMin: number
  repMax: number
  restSec: number
}

export interface RoutineDay {
  key: string
  name: string
  exercises: RoutineExercise[]
}

export interface Routine {
  id?: number
  createdAt: number
  source: 'local' | 'ia'
  profile: Profile
  days: RoutineDay[]
  /** Sequência da semana (chaves de dia); o app segue em rotação contínua. */
  schedule: string[]
  warnings: string[]
  /** Justificativa curta quando vem da IA. */
  notes?: string
}

interface Slot {
  groups: MuscleGroup[]
  patterns: MovementPattern[]
  /** Padrões de qualquer grupo, usados se nada do grupo estiver disponível. */
  fallback?: MovementPattern[]
}

interface DayTemplate {
  name: string
  /** Em ordem de prioridade: os primeiros N preenchíveis entram no dia. */
  slots: Slot[]
}

const s = (groups: MuscleGroup | MuscleGroup[], patterns: MovementPattern[], fallback?: MovementPattern[]): Slot => ({
  groups: Array.isArray(groups) ? groups : [groups],
  patterns,
  fallback,
})

// Slots reutilizados
const SQUAT = s('quadriceps', ['agachamento', 'avanco'])
const LUNGE = s('quadriceps', ['avanco', 'agachamento'])
const HINGE = s(['posteriores', 'gluteos'], ['terra', 'gluteo', 'flexora'])
const LEG_CURL = s('posteriores', ['flexora', 'terra'], ['gluteo'])
const LEG_EXT = s('quadriceps', ['extensora', 'avanco'])
const GLUTE = s('gluteos', ['gluteo'])
const CALF = s('panturrilhas', ['panturrilha'])
const ABS = s('abdomen', ['abdominal'])
const CHEST = s('peito', ['empurrar_horizontal', 'empurrar_inclinado'])
const CHEST_INCLINE = s('peito', ['empurrar_inclinado', 'empurrar_horizontal'])
const CHEST_FLY = s('peito', ['crucifixo'])
const OHP = s('ombros', ['empurrar_vertical'], ['empurrar_inclinado'])
const LATERAL = s('ombros', ['elevacao_lateral'])
const REAR_DELT = s('ombros', ['deltoide_posterior'])
const FRONT_DELT = s('ombros', ['elevacao_frontal'])
const ROW = s('costas', ['puxar_horizontal', 'puxar_vertical'])
const PULLDOWN = s('costas', ['puxar_vertical', 'puxar_horizontal'])
const LAT_ISO = s('costas', ['pulldown_isolado', 'puxar_horizontal'])
const CURL = s('biceps', ['rosca'])
const TRI = s('triceps', ['triceps_isolado', 'triceps_composto'])
const TRI_COMPOUND = s('triceps', ['triceps_composto', 'triceps_isolado'])
const SHRUG = s('trapezio', ['encolhimento'])

const LEGS: DayTemplate = { name: 'Pernas e abdômen', slots: [SQUAT, HINGE, LUNGE, LEG_CURL, LEG_EXT, CALF, GLUTE, ABS] }

const TEMPLATES: Record<Split, DayTemplate[]> = {
  AB: [
    { name: 'Empurrar + quadríceps', slots: [SQUAT, CHEST, OHP, CHEST_INCLINE, LEG_EXT, TRI, LATERAL, CALF] },
    { name: 'Puxar + posteriores', slots: [HINGE, PULLDOWN, ROW, LEG_CURL, CURL, GLUTE, REAR_DELT, ABS] },
  ],
  ABC: [
    { name: 'Peito, ombros e tríceps', slots: [CHEST, OHP, CHEST_INCLINE, LATERAL, TRI, CHEST_FLY, TRI_COMPOUND] },
    { name: 'Costas e bíceps', slots: [PULLDOWN, ROW, ROW, REAR_DELT, CURL, CURL, LAT_ISO, SHRUG] },
    LEGS,
  ],
  ABCD: [
    { name: 'Peito e tríceps', slots: [CHEST, CHEST_INCLINE, TRI_COMPOUND, CHEST_FLY, TRI, TRI, CHEST] },
    { name: 'Costas e bíceps', slots: [PULLDOWN, ROW, ROW, CURL, LAT_ISO, CURL, SHRUG] },
    { ...LEGS, name: 'Pernas' },
    // TRI_COMPOUND no fim: reserva para peso corporal, onde não há elevações nem encolhimento
    { name: 'Ombros e abdômen', slots: [OHP, LATERAL, REAR_DELT, ABS, FRONT_DELT, SHRUG, ABS, TRI_COMPOUND] },
  ],
  upper_lower: [
    { name: 'Superiores', slots: [CHEST, ROW, OHP, PULLDOWN, CURL, TRI, LATERAL, CHEST_INCLINE] },
    { name: 'Inferiores', slots: [SQUAT, HINGE, LUNGE, LEG_CURL, CALF, LEG_EXT, ABS, GLUTE] },
  ],
  full_body: [
    { name: 'Full body 1', slots: [SQUAT, CHEST, ROW, HINGE, OHP, CURL, TRI, ABS] },
    { name: 'Full body 2', slots: [HINGE, CHEST_INCLINE, PULLDOWN, LUNGE, LATERAL, TRI, CURL, CALF] },
    { name: 'Full body 3', slots: [LUNGE, PULLDOWN, CHEST, LEG_CURL, OHP, ABS, CURL, TRI] },
  ],
}

/** Completa dias que ficaram abaixo do mínimo por falta de equipamento. */
const COMPLEMENT: Slot[] = [ABS, GLUTE, ABS, CALF, LUNGE]

const CURATED_ORDER =new Map(CURATED.map((c, i) => [c.id, i]))
const MIN_PER_DAY = 4
const MAX_PER_DAY = 6

/** Equipamento de cada id, vindo do catálogo carregado. */
export type EquipmentLookup = (id: string) => string | undefined

/**
 * Gera a rotina de forma determinística (mesmo perfil + mesmo catálogo → mesma rotina).
 * Regras: respeita o equipamento, 4–6 exercícios por dia, sem repetir no dia,
 * compostos antes de isoladores, evita repetir exercício entre dias da semana.
 */
export function generateRoutine(profile: Profile, equipmentOf: EquipmentLookup, now = Date.now()): Routine {
  const pool = CURATED.filter((c) => isAvailable(profile, c.id, equipmentOf(c.id)))
  const beginner = profile.level === 'iniciante'
  const preferLoaded = profile.equipment !== 'peso_corporal'
  const target = Math.min(MAX_PER_DAY, Math.max(MIN_PER_DAY, EXERCISES_PER_DAY[profile.level]))
  const templates = TEMPLATES[profile.split]
  const keys = SPLIT_DAY_KEYS[profile.split].slice(0, profile.split === 'full_body' ? Math.min(3, profile.daysPerWeek) : undefined)
  const weekUsed = new Set<string>()
  const warnings: string[] = []

  const pick = (slot: Slot, day: CuratedExercise[]): CuratedExercise | undefined => {
    const free = (c: CuratedExercise) => !day.some((d) => d.id === c.id)
    const basic = (c: CuratedExercise) => !beginner || !ADVANCED_IDS.has(c.id)
    const primary = pool.filter((c) => slot.groups.includes(c.group) && slot.patterns.includes(c.pattern) && free(c))
    const fallback = slot.fallback ? pool.filter((c) => slot.fallback!.includes(c.pattern) && free(c)) : []
    // ordem de preferência: primário acessível ao nível → reserva acessível → primário avançado → reserva avançada
    const tiers: [CuratedExercise[], MovementPattern[]][] = [
      [primary.filter(basic), slot.patterns],
      [fallback.filter(basic), slot.fallback ?? []],
      [primary, slot.patterns],
      [fallback, slot.fallback ?? []],
    ]
    const [cands, patterns] = tiers.find(([list]) => list.length) ?? [[], []]
    const isBodyweight = (c: CuratedExercise) => equipmentOf(c.id) === 'body weight' && !NEEDS_BAR_IDS.has(c.id)
    // mesmo padrão e mesmo equipamento de algo já escolhido no dia = variação redundante
    const redundant = (c: CuratedExercise) =>
      day.some((d) => d.pattern === c.pattern && equipmentOf(d.id) === equipmentOf(c.id))
    const rank = (c: CuratedExercise) => [
      preferLoaded && isBodyweight(c) ? 1 : 0,
      patterns.indexOf(c.pattern),
      redundant(c) ? 1 : 0,
      weekUsed.has(c.id) ? 1 : 0,
      CURATED_ORDER.get(c.id)!,
    ]
    return [...cands].sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
      return 0
    })[0]
  }

  const days: RoutineDay[] = keys.map((key, i) => {
    const tpl = templates[i]
    const chosen: { ex: CuratedExercise; group: MuscleGroup; order: number }[] = []
    for (const slot of tpl.slots) {
      if (chosen.length >= target) break
      const ex = pick(
        slot,
        chosen.map((c) => c.ex),
      )
      if (!ex) continue
      chosen.push({ ex, group: slot.groups[0], order: chosen.length })
    }
    if (chosen.length < MIN_PER_DAY) {
      const before = chosen.length
      for (const slot of COMPLEMENT) {
        if (chosen.length >= MIN_PER_DAY) break
        const ex = pick(
          slot,
          chosen.map((c) => c.ex),
        )
        if (ex) chosen.push({ ex, group: slot.groups[0], order: chosen.length })
      }
      warnings.push(
        `Treino ${key}: com esse equipamento só há ${before} exercício(s) para ${tpl.name.toLowerCase()}; ` +
          `completei com core/pernas.` +
          (hasPullupBar(profile) ? '' : ' Uma barra fixa de porta amplia muito as opções de costas.'),
      )
    }
    if (chosen.length < MIN_PER_DAY) {
      warnings.push(`Treino ${key}: só ${chosen.length} exercícios disponíveis com esse equipamento.`)
    }
    chosen.forEach((c) => weekUsed.add(c.ex.id))
    // compostos antes de isoladores, mantendo a prioridade dos slots
    chosen.sort((a, b) => Number(b.ex.compound) - Number(a.ex.compound) || a.order - b.order)
    return {
      key,
      name: `Treino ${key} — ${tpl.name}`,
      exercises: chosen.map(({ ex, group }) => ({
        exerciseId: ex.id,
        group,
        compound: ex.compound,
        ...prescribe(profile.goal, profile.level, ex.compound),
      })),
    }
  })

  const schedule = Array.from({ length: profile.daysPerWeek }, (_, i) => keys[i % keys.length])
  if (profile.daysPerWeek < keys.length) {
    warnings.push(
      `Com ${profile.daysPerWeek} dias por semana, a divisão ${keys.join('')} roda em sequência contínua: nem todo treino cabe em uma semana.`,
    )
  }
  return { createdAt: now, source: 'local', profile, days, schedule, warnings }
}

/**
 * Troca o exercício `index` do dia `dayKey` por `newId`. Mantém séries/reps se o
 * tipo (composto/isolador) for o mesmo; senão, prescreve de novo. Reordena para
 * manter compostos antes de isoladores.
 */
export function swapExercise(routine: Routine, dayKey: string, index: number, newId: string): Routine {
  const compound = CURATED_BY_ID.get(newId)?.compound ?? false
  const days = routine.days.map((d) => {
    if (d.key !== dayKey) return d
    const exercises = d.exercises.map((e, i) => {
      if (i !== index) return e
      const keep = e.compound === compound
      return {
        ...e,
        exerciseId: newId,
        compound,
        ...(keep ? {} : prescribe(routine.profile.goal, routine.profile.level, compound)),
      }
    })
    const ordered = exercises
      .map((e, i) => ({ e, i }))
      .sort((a, b) => Number(b.e.compound) - Number(a.e.compound) || a.i - b.i)
      .map(({ e }) => e)
    return { ...d, exercises: ordered }
  })
  return { ...routine, days }
}

/** Próximo dia da rotação, dado o último dia treinado. */
export function nextDayKey(routine: Routine, lastKey: string | undefined): string {
  const keys = routine.days.map((d) => d.key)
  if (!lastKey) return keys[0]
  const i = keys.indexOf(lastKey)
  return keys[(i + 1) % keys.length]
}
