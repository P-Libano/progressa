import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { ProgressaDB, db } from '../db'
import type { Profile } from '../domain/profile'
import { getActiveRoutine, getProfile, replaceExercise, saveProfileAndGenerate } from './routineStore'

const profile: Profile = { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }

beforeAll(async () => {
  await db.exercises.bulkPut(loadFixtureCatalog())
})

describe('routineStore', () => {
  it('salva perfil + rotina ativa e sobrevive a reabrir o banco', async () => {
    const r = await saveProfileAndGenerate(profile)
    expect(r.id).toBeDefined()
    db.close()
    const other = new ProgressaDB()
    expect(await other.routines.count()).toBe(1)
    other.close()
    await db.open()
    expect(await getProfile()).toEqual(profile)
    expect((await getActiveRoutine())?.days.map((d) => d.key)).toEqual(['A', 'B', 'C'])
  })

  it('troca de exercício persiste e mantém compostos antes de isoladores', async () => {
    const r = (await getActiveRoutine())!
    const dayA = r.days[0]
    const isoIndex = dayA.exercises.findIndex((e) => !e.compound)
    // troca um isolador por um composto: deve subir para o bloco de compostos e receber prescrição de composto
    await replaceExercise(r.id!, 'A', isoIndex, '0289')
    const after = (await getActiveRoutine())!.days[0].exercises
    const swapped = after.find((e) => e.exerciseId === '0289')!
    expect(swapped.compound).toBe(true)
    expect([swapped.sets, swapped.repMin, swapped.repMax]).toEqual([4, 8, 12])
    const firstIso = after.findIndex((e) => !e.compound)
    expect(after.slice(firstIso).every((e) => !e.compound)).toBe(true)
    expect(after).toHaveLength(dayA.exercises.length)
  })

  it('gerar de novo cria nova rotina ativa e guarda a anterior', async () => {
    await saveProfileAndGenerate({ ...profile, split: 'AB', daysPerWeek: 4 })
    expect(await db.routines.count()).toBe(2)
    expect((await getActiveRoutine())?.schedule).toEqual(['A', 'B', 'A', 'B'])
  })
})
