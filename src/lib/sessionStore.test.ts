import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { db } from '../db'
import { nextDayKey, type Routine } from '../domain/generator'
import { saveProfileAndGenerate } from './routineStore'
import {
  finishSession,
  getActiveSession,
  lastDoneSession,
  setWeightFrom,
  startOrResume,
  toggleSetDone,
  updateSet,
} from './sessionStore'

let routine: Routine

beforeAll(async () => {
  await db.exercises.bulkPut(loadFixtureCatalog())
  routine = await saveProfileAndGenerate({
    split: 'ABC',
    daysPerWeek: 3,
    goal: 'hipertrofia',
    equipment: 'academia',
    level: 'iniciante', // 3x8–12 em tudo
  })
})

/** Faz o treino inteiro com a mesma carga e reps em todos os exercícios. */
async function doWorkout(dayKey: string, weight: number, reps: number[], day: number) {
  const id = await startOrResume(routine, dayKey, day)
  const s = (await db.sessions.get(id))!
  for (let ex = 0; ex < s.exercises.length; ex++) {
    await setWeightFrom(id, ex, 0, weight)
    for (let set = 0; set < reps.length; set++) {
      await updateSet(id, ex, set, { reps: reps[set] })
      await toggleSetDone(id, ex, set, day)
    }
  }
  await finishSession(id, day + 3600_000)
  return id
}

describe('sessionStore + progressão', () => {
  it('sessão nova sem histórico não sugere carga', async () => {
    const id = await startOrResume(routine, 'A', 1)
    const s = (await db.sessions.get(id))!
    expect(s.exercises[0].suggestion.kind).toBe('start')
    expect(s.exercises[0].log.map((l) => l.weight)).toEqual([null, null, null])
    // retomar devolve a mesma sessão ativa
    expect(await startOrResume(routine, 'B', 2)).toBe(id)
    await db.sessions.delete(id)
  })

  it('12/12/12 a 60 kg → próxima sessão do dia A já vem com 62,5 kg (superior)', async () => {
    await doWorkout('A', 60, [12, 12, 12], 1000)
    const id = await startOrResume(routine, 'A', 2000)
    const s = (await db.sessions.get(id))!
    const first = s.exercises[0]
    console.log('próxima sessão A, 1º exercício:', JSON.stringify({ suggestion: first.suggestion, log: first.log, previous: first.previous }))
    expect(first.suggestion).toMatchObject({ kind: 'increase', weight: 62.5 })
    expect(first.log.every((l) => l.weight === 62.5)).toBe(true)
    expect(first.previous?.sets.map((x) => x.reps)).toEqual([12, 12, 12])
    await db.sessions.delete(id)
  })

  it('dia de pernas (C): 12/12/12 a 80 kg → 85 kg nos exercícios de membros inferiores', async () => {
    await doWorkout('C', 80, [12, 12, 12], 3000)
    const id = await startOrResume(routine, 'C', 4000)
    const s = (await db.sessions.get(id))!
    const sug = s.exercises.map((e) => `${e.group}:${e.suggestion.weight}`)
    console.log('próxima sessão C:', sug.join(', '))
    expect(s.exercises.filter((e) => e.group !== 'abdomen').every((e) => e.suggestion.weight === 85)).toBe(true)
    await db.sessions.delete(id)
  })

  it('marcar série sem digitar reps assume o topo da faixa e inicia descanso', async () => {
    const id = await startOrResume(routine, 'B', 5000)
    await toggleSetDone(id, 0, 0, 5000)
    const s = (await getActiveSession())!
    expect(s.exercises[0].log[0]).toMatchObject({ done: true, reps: 12 })
    expect(s.restUntil).toBe(5000 + s.exercises[0].restSec * 1000)
    await db.sessions.delete(id)
  })

  it('próximo dia segue a última sessão concluída', async () => {
    const last = await lastDoneSession(routine.id!)
    expect(last?.dayKey).toBe('C')
    expect(nextDayKey(routine, last?.dayKey)).toBe('A')
  })
})
