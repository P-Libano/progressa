import { describe, expect, it } from 'vitest'
import type { MuscleGroup } from '../data/curated'
import type { Session, SessionExercise } from './session'
import { addWeeks, epley, exercisesWithHistory, loadSeries, previousSameDay, sessionsByWeek, weekStart, weeklySetsByGroup, weeklyTonnage } from './stats'

const at = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h).getTime()

function ex(exerciseId: string, group: MuscleGroup, weight: number, reps: (number | null)[]): SessionExercise {
  const prescription = { exerciseId, role: 'composto' as const, group, sets: reps.length, reps: { min: 8, max: 12 }, restSec: 90 }
  return {
    exerciseId,
    role: 'composto',
    group,
    groupIndex: 0,
    groupKind: 'simples',
    prescription,
    suggestion: { kind: 'start', weight: null, failStreak: 0, reason: '' },
    log: reps.map((r) => ({ weight, reps: r, rpe: null, done: r !== null })),
  }
}

function sess(id: number, startedAt: number, exercises: SessionExercise[], status: Session['status'] = 'done'): Session {
  return {
    id,
    programId: 1,
    weekIndex: 1,
    weekKind: 'carga',
    dayKey: 'A1',
    dayName: 'Treino A',
    startedAt,
    finishedAt: startedAt + 3600_000,
    status,
    exerciseIds: exercises.map((e) => e.exerciseId),
    exercises,
  }
}

// semana de 12/10/2026 (segunda) e a seguinte
const sessions = [
  sess(1, at(2026, 10, 12), [ex('0025', 'peito', 60, [12, 12, 12]), ex('0043', 'quadriceps', 80, [10, 10, 9])]),
  sess(2, at(2026, 10, 14), [ex('0025', 'peito', 62.5, [10, 9, null]), ex('0027', 'costas', 50, [12, 12, 12])]),
  sess(3, at(2026, 10, 19), [ex('0025', 'peito', 62.5, [12, 11, 10])]),
  sess(4, at(2026, 10, 20), [ex('0025', 'peito', 100, [1])], 'active'), // em andamento: ignorada
]

describe('stats', () => {
  it('weekStart cai na segunda 00:00', () => {
    expect(new Date(weekStart(at(2026, 10, 14))).toString()).toContain('Mon Oct 12 2026 00:00')
    expect(new Date(weekStart(at(2026, 10, 18, 23))).getDate()).toBe(12) // domingo → segunda anterior
    expect(new Date(addWeeks(weekStart(at(2026, 10, 14)), 1)).getDate()).toBe(19)
  })

  it('série de carga do supino, só sessões concluídas e séries feitas', () => {
    const s = loadSeries('0025', sessions)
    console.log('loadSeries(supino):', JSON.stringify(s))
    expect(s.map((p) => [p.weight, p.reps])).toEqual([
      [60, '12/12/12'],
      [62.5, '10/9'],
      [62.5, '12/11/10'],
    ])
    expect(s[0].e1rm).toBe(Math.round(epley(60, 12) * 10) / 10) // 84
  })

  it('séries por grupo na semana', () => {
    const w = weekStart(at(2026, 10, 12))
    const v = weeklySetsByGroup(sessions, w)
    console.log('semana 12/10:', JSON.stringify(Object.fromEntries(Object.entries(v).filter(([, n]) => n))))
    expect(v).toMatchObject({ peito: 5, quadriceps: 3, costas: 3, ombros: 0 })
    expect(weeklySetsByGroup(sessions, addWeeks(w, 1)).peito).toBe(3)
  })

  it('exercícios com histórico, mais recente primeiro', () => {
    expect(exercisesWithHistory(sessions).map((e) => [e.exerciseId, e.sessions])).toEqual([
      ['0025', 3],
      ['0027', 1],
      ['0043', 1],
    ])
  })

  it('sessões agrupadas por semana, mais recente primeiro', () => {
    const g = sessionsByWeek(sessions)
    expect(g.map((x) => x.sessions.map((s) => s.id))).toEqual([[3], [2, 1]])
    expect(g[1].sessions[1].summary).toMatchObject({ sets: 6, volumeKg: 60 * 36 + 80 * 29 })
  })

  it('volume levantado por semana, com semanas vazias', () => {
    const t = weeklyTonnage(sessions, 3, at(2026, 10, 20))
    console.log('tonelagem:', JSON.stringify(t.map((p) => [new Date(p.week).getDate(), p.kg, p.sessions])))
    expect(t.map((p) => [new Date(p.week).getDate(), p.kg, p.sessions])).toEqual([
      [5, 0, 0],
      [12, 60 * 36 + 80 * 29 + 62.5 * 19 + 50 * 36, 2],
      [19, 62.5 * 33, 1], // sessão em andamento não conta
    ])
  })

  it('sessão anterior do mesmo dia para comparar', () => {
    expect(previousSameDay(sessions[2], sessions)?.id).toBe(2)
    expect(previousSameDay(sessions[0], sessions)).toBeUndefined()
  })
})
