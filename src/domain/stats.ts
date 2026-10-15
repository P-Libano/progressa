import { MUSCLE_GROUPS, type MuscleGroup } from '../data/curated'
import { estimate1rm } from '../programacao/progression/carga'
import { totalReps, workingWeight } from '../programacao/progression/common'
import { sessionSummary, toResult, type Session } from './session'

const DAY = 24 * 60 * 60 * 1000

/** Segunda-feira 00:00 (horário local) da semana de `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const dow = (d.getDay() + 6) % 7 // 0 = segunda
  d.setDate(d.getDate() - dow)
  return d.getTime()
}

export const addWeeks = (weekTs: number, n: number) => {
  const d = new Date(weekTs)
  d.setDate(d.getDate() + n * 7)
  return d.getTime()
}

const done = (sessions: Session[]) =>
  sessions.filter((s) => s.status === 'done').sort((a, b) => a.startedAt - b.startedAt)

export interface LoadPoint {
  date: number
  weight: number
  reps: string // "12/12/11"
  totalReps: number
  /** 1RM estimado (Epley) da melhor série. */
  e1rm: number
  /** Peso × reps somado nas séries. */
  volumeKg: number
}

export { epley } from '../programacao/progression/carga'

/** Série temporal de carga de um exercício (uma entrada por sessão concluída). */
export function loadSeries(exerciseId: string, sessions: Session[]): LoadPoint[] {
  return done(sessions).flatMap((s) =>
    s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .filter((e) => e.role !== 'condicionamento')
      .map((e) => toResult(e, s.startedAt, s.weekKind))
      .filter((r) => r.sets.length > 0)
      .map((r) => ({
        date: r.date,
        weight: workingWeight(r),
        reps: r.sets.map((x) => x.reps).join('/'),
        totalReps: totalReps(r),
        e1rm: estimate1rm(r.sets)?.e1rm ?? 0,
        volumeKg: r.sets.reduce((a, x) => a + x.weight * x.reps, 0),
      })),
  )
}

/** Exercícios com histórico, do mais recente para o mais antigo. */
export function exercisesWithHistory(sessions: Session[]): { exerciseId: string; sessions: number; last: number }[] {
  const map = new Map<string, { sessions: number; last: number }>()
  for (const s of done(sessions)) {
    for (const e of s.exercises) {
      if (e.role === 'condicionamento' || !e.log.some((l) => l.done)) continue
      const cur = map.get(e.exerciseId) ?? { sessions: 0, last: 0 }
      map.set(e.exerciseId, { sessions: cur.sessions + 1, last: Math.max(cur.last, s.startedAt) })
    }
  }
  return [...map.entries()].map(([exerciseId, v]) => ({ exerciseId, ...v })).sort((a, b) => b.last - a.last)
}

/** Séries concluídas por grupo muscular na semana que começa em `week`. Conta o grupo principal do exercício. */
export function weeklySetsByGroup(sessions: Session[], week: number): Record<MuscleGroup, number> {
  const out = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>
  const end = addWeeks(week, 1)
  for (const s of done(sessions)) {
    if (s.startedAt < week || s.startedAt >= end) continue
    for (const e of s.exercises) out[e.group] += e.log.filter((l) => l.done && l.reps !== null).length
  }
  return out
}

export interface TonnagePoint {
  week: number
  /** Peso × reps somado em todas as séries concluídas da semana. */
  kg: number
  sessions: number
}

/** Volume levantado por semana: as `n` semanas até a de `now`, inclusive as vazias (ordem cronológica). */
export function weeklyTonnage(sessions: Session[], n = 8, now = Date.now()): TonnagePoint[] {
  const current = weekStart(now)
  const out = Array.from({ length: n }, (_, i): TonnagePoint => ({ week: addWeeks(current, i - n + 1), kg: 0, sessions: 0 }))
  const byWeek = new Map(out.map((p) => [p.week, p]))
  for (const s of done(sessions)) {
    const p = byWeek.get(weekStart(s.startedAt))
    if (!p) continue
    p.kg += sessionSummary(s).volumeKg
    p.sessions++
  }
  return out
}

/** Última sessão concluída do mesmo dia do programa, antes desta (para comparar o volume). */
export function previousSameDay(s: Session, sessions: Session[]): Session | undefined {
  return done(sessions)
    .filter((x) => x.id !== s.id && x.programId === s.programId && x.dayKey === s.dayKey && x.startedAt < s.startedAt)
    .at(-1)
}

export interface WeekGroup {
  week: number
  sessions: (Session & { summary: ReturnType<typeof sessionSummary> })[]
}

/** Sessões concluídas agrupadas por semana, mais recente primeiro. */
export function sessionsByWeek(sessions: Session[]): WeekGroup[] {
  const groups = new Map<number, WeekGroup['sessions']>()
  for (const s of done(sessions).reverse()) {
    const w = weekStart(s.startedAt)
    if (!groups.has(w)) groups.set(w, [])
    groups.get(w)!.push({ ...s, summary: sessionSummary(s) })
  }
  return [...groups.entries()].map(([week, list]) => ({ week, sessions: list }))
}

export const fmtDay = (ts: number) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
export const fmtWeek = (week: number) => `${fmtDay(week)} – ${fmtDay(week + 6 * DAY)}`
