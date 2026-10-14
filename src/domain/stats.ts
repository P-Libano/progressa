import { MUSCLE_GROUPS, type MuscleGroup } from '../data/curated'
import { totalReps, workingWeight } from './progression'
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
}

export const epley = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))

/** Série temporal de carga de um exercício (uma entrada por sessão concluída). */
export function loadSeries(exerciseId: string, sessions: Session[]): LoadPoint[] {
  return done(sessions).flatMap((s) =>
    s.exercises
      .filter((e) => e.exerciseId === exerciseId)
      .map((e) => toResult(e, s.startedAt))
      .filter((r) => r.sets.length > 0)
      .map((r) => ({
        date: r.date,
        weight: workingWeight(r),
        reps: r.sets.map((x) => x.reps).join('/'),
        totalReps: totalReps(r),
        e1rm: Math.round(Math.max(...r.sets.map((x) => epley(x.weight, x.reps))) * 10) / 10,
      })),
  )
}

/** Exercícios com histórico, do mais recente para o mais antigo. */
export function exercisesWithHistory(sessions: Session[]): { exerciseId: string; sessions: number; last: number }[] {
  const map = new Map<string, { sessions: number; last: number }>()
  for (const s of done(sessions)) {
    for (const e of s.exercises) {
      if (!e.log.some((l) => l.done)) continue
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
