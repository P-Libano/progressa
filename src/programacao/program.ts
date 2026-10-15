import { CURATED_BY_ID } from '../data/curated'
import { SPLIT_DAY_KEYS } from '../domain/profile'
import { explain } from './explain'
import { resolveRole, volumeOf, type EquipmentLookup } from './generator'
import { GOALS } from './goals'
import { META_BY_ID, fitsRole } from './meta'
import type { Day, ExerciseMeta, ExercisePrescription, ExerciseRole, GoalProfile, Program, UserProfile, Week } from './types'

export const allWeeks = (p: Program): Week[] => p.blocks.flatMap((b) => b.weeks)
export const weekAt = (p: Program, index: number): Week => allWeeks(p).find((w) => w.index === index) ?? allWeeks(p)[0]

/** Chaves dos dias de uma semana-tipo para o perfil (mesma regra do gerador). */
export function weekDayKeys(profile: UserProfile): string[] {
  const letters = SPLIT_DAY_KEYS[profile.split]
  const L = letters.length
  if (profile.daysPerWeek < L) return letters.map((l) => `${l}1`)
  return Array.from({ length: profile.daysPerWeek }, (_, j) => `${letters[j % L]}${Math.floor(j / L) + 1}`)
}

export interface Position {
  weekIndex: number
  dayIndex: number
}

/** Próximo treino depois da última sessão concluída (volta à semana 1 ao fim do programa). */
export function nextPosition(p: Program, last?: { weekIndex: number; dayKey: string }): Position {
  const weeks = allWeeks(p)
  if (!last) return { weekIndex: weeks[0].index, dayIndex: 0 }
  const wi = Math.max(0, weeks.findIndex((w) => w.index === last.weekIndex))
  const di = weeks[wi].days.findIndex((d) => d.key === last.dayKey)
  if (di >= 0 && di + 1 < weeks[wi].days.length) return { weekIndex: weeks[wi].index, dayIndex: di + 1 }
  const nw = weeks[(wi + 1) % weeks.length]
  return { weekIndex: nw.index, dayIndex: 0 }
}

const CONVERT_LOW = 6

/** Prescrição de um exercício num papel, para o objetivo e nível do programa. */
export function prescriptionFor(
  goal: GoalProfile,
  profile: UserProfile,
  m: ExerciseMeta,
  role: ExerciseRole,
  bodyweight: boolean,
  base?: Partial<Pick<ExercisePrescription, 'sets' | 'reps' | 'restSec'>>,
): ExercisePrescription {
  const r = role === 'condicionamento' ? undefined : resolveRole(goal, role, profile.level) ?? resolveRole(goal, 'composto', profile.level) ?? resolveRole(goal, 'isolador', profile.level)
  let reps = base?.reps ?? r?.reps
  if (reps && reps.min < CONVERT_LOW && !m.adequadoBaixasReps) reps = { min: CONVERT_LOW, max: Math.max(8, reps.max) }
  return {
    exerciseId: m.id,
    role,
    group: m.group,
    sets: base?.sets ?? r?.sets ?? 3,
    ...(reps ? { reps: { ...reps } } : {}),
    restSec: base?.restSec ?? r?.restSec ?? 60,
    ...(r?.intensity.pct1rm && !bodyweight ? { pct1rm: { ...r.intensity.pct1rm } } : {}),
    ...(r?.intensity.rpe ? { rpe: { ...r.intensity.rpe } } : {}),
  }
}

/** Papel que o exercício assume ao entrar num slot de papel `slot`. */
export function roleOnSwap(m: ExerciseMeta, slot: ExerciseRole): ExerciseRole {
  if (fitsRole(m, slot)) return slot
  if (slot === 'principal' && m.adequadoBaixasReps) return 'principal'
  return m.role
}

/**
 * Troca o exercício (grupo `gi`, item `ii`) do dia `dayKey` em todas as semanas. Mantém o papel quando o
 * novo exercício serve; senão prescreve de novo. Em semana de deload, mantém a redução de séries.
 */
export function swapInProgram(
  p: Program,
  dayKey: string,
  gi: number,
  ii: number,
  newId: string,
  equipmentOf: EquipmentLookup,
): Program {
  const clone: Program = JSON.parse(JSON.stringify(p))
  for (const w of allWeeks(clone)) {
    for (const d of w.days.filter((x) => x.key === dayKey)) {
      const item = d.groups[gi]?.items[ii]
      if (!item) continue
      // fora do catálogo curado: herda grupo e papel do exercício trocado
      const m =
        META_BY_ID.get(newId) ??
        ({ ...fallbackMeta(newId), group: item.group, role: item.role === 'principal' ? 'composto' : item.role } satisfies ExerciseMeta)
      const role = roleOnSwap(m, item.role)
      const keep = role === item.role && (!item.reps || item.reps.min >= CONVERT_LOW || m.adequadoBaixasReps)
      d.groups[gi].items[ii] = keep
        ? { ...item, exerciseId: m.id, group: m.group, ...(equipmentOf(m.id) === 'body weight' ? { pct1rm: undefined } : {}) }
        : { ...prescriptionFor(p.goal, p.profile, m, role, equipmentOf(m.id) === 'body weight'), sets: item.sets }
    }
  }
  clone.weeklyVolume = volumeOf(allWeeks(clone).slice(0, 1).flatMap((w) => w.days.map((d) => ({ groups: d.groups, weight: 1 }))))
  return clone
}

export interface PlainDay {
  key: string
  name: string
  exercises: { exerciseId: string; sets: number; repMin: number; repMax: number; restSec: number }[]
}

/**
 * Monta um Program a partir de dias "planos" (rotina da IA ou rotina v1 migrada): cada exercício vira um
 * grupo simples, com papel do catálogo e intensidade do objetivo. `singleWeek` = 1 semana de carga
 * (migração); senão aplica a periodização do objetivo.
 */
export function programFromDays(
  profile: UserProfile,
  days: PlainDay[],
  equipmentOf: EquipmentLookup,
  opts: { source: Program['source']; notes?: string; singleWeek?: boolean; warnings?: string[]; now?: number },
): Program {
  const goal = GOALS[profile.goal]
  const baseDays: Day[] = days.map((d) => ({
    key: d.key,
    name: d.name,
    groups: d.exercises.map((e, i) => {
      const m = META_BY_ID.get(e.exerciseId) ?? fallbackMeta(e.exerciseId)
      const role: ExerciseRole =
        m.role === 'principal' && i === 0 && goal.roles.principal ? 'principal' : m.role === 'principal' ? 'composto' : m.role
      return {
        kind: 'simples' as const,
        items: [
          prescriptionFor(goal, profile, m, role, equipmentOf(m.id) === 'body weight', {
            sets: e.sets,
            reps: { min: e.repMin, max: e.repMax },
            restSec: e.restSec,
          }),
        ],
      }
    }),
  }))
  const per = goal.periodization
  const n = opts.singleWeek ? 1 : per.kind === 'bloco' ? per.semanasCarga + per.semanasDeload : per.deloadPlanejadoACadaSemanas
  const loadWeeks = opts.singleWeek ? 1 : per.kind === 'bloco' ? per.semanasCarga : per.deloadPlanejadoACadaSemanas - 1
  const dl = per.deload
  const weeks: Week[] = Array.from({ length: n }, (_, w) => {
    const kind = w < loadWeeks ? ('carga' as const) : ('deload' as const)
    const daysW: Day[] = JSON.parse(JSON.stringify(baseDays))
    if (kind === 'deload')
      for (const d of daysW)
        for (const g of d.groups)
          for (const it of g.items) {
            it.sets = Math.max(1, Math.round(it.sets * dl.fatorSeries))
            if (it.pct1rm) it.pct1rm = { min: Math.round(it.pct1rm.min * dl.fatorCarga), max: Math.round(it.pct1rm.max * dl.fatorCarga) }
            if (it.rpe) it.rpe = { min: Math.min(it.rpe.min, dl.rpeMax - 1), max: dl.rpeMax }
          }
    return { index: w + 1, kind, days: daysW }
  })
  const view = baseDays.map((d) => ({ groups: d.groups, weight: 1 }))
  const program: Program = {
    createdAt: opts.now ?? Date.now(),
    source: opts.source,
    profile,
    goal: JSON.parse(JSON.stringify(goal)),
    blocks: [{ index: 1, weeks }],
    repeat: true,
    weeklyVolume: volumeOf(view),
    explanation: '',
    warnings: opts.warnings ?? [],
    ...(opts.notes ? { notes: opts.notes } : {}),
  }
  program.explanation = explain(program, (id) => META_BY_ID.get(id)?.pt ?? id)
  return program
}

/** Exercício fora do catálogo curado (ex.: trocado pelo usuário para um item só do dataset). */
export function fallbackMeta(id: string): ExerciseMeta {
  const c = CURATED_BY_ID.get(id)
  return {
    id,
    pt: c?.pt ?? id,
    group: c?.group ?? 'abdomen',
    pattern: c?.pattern ?? 'abdominal',
    role: c?.compound ? 'composto' : 'isolador',
    unilateral: false,
    massaMuscular: 'pequena',
    adequadoBaixasReps: false,
  }
}
