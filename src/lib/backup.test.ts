import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { ProgressaDB, db } from '../db'
import { allWeeks } from '../programacao/program'
import { BackupError, exportData, importData, parseBackup, wipeUserData } from './backup'
import { getActiveProgram, getProfile, saveProfileAndGenerate } from './programStore'
import { finishSession, startOrResume, toggleSetDone, updateSet } from './sessionStore'

let sessionId: number

beforeAll(async () => {
  await db.exercises.bulkPut(loadFixtureCatalog())
  const program = await saveProfileAndGenerate({
    split: 'ABC',
    daysPerWeek: 3,
    goal: 'hipertrofia',
    equipment: 'academia',
    level: 'intermediario',
  })
  const day = allWeeks(program)[0].days[0]
  sessionId = await startOrResume(program, 1, day.key, 1_000)
  await updateSet(sessionId, 0, 0, { weight: 60, reps: 12, rpe: 8 })
  await toggleSetDone(sessionId, 0, 0, 1_000)
  await finishSession(sessionId, 2_000)
})

describe('persistência e backup (formato 2)', () => {
  it('sessão persiste ao reabrir o banco, com RPE e horário da série', async () => {
    db.close()
    const reopened = new ProgressaDB()
    const s = await reopened.sessions.get(sessionId)
    console.log('reaberto:', JSON.stringify({ id: s?.id, status: s?.status, set1: s?.exercises[0].log[0], durationSec: s?.durationSec }))
    expect(s?.exercises[0].log[0]).toEqual({ weight: 60, reps: 12, rpe: 8, done: true, completedAt: 1_000 })
    reopened.close()
    await db.open()
  })

  it('exporta, apaga tudo, importa e a sessão volta igual', async () => {
    const before = await db.sessions.get(sessionId)
    const json = JSON.stringify(await exportData(new Date('2026-10-14T12:00:00Z')))
    console.log(`export: ${json.length} bytes; chaves: ${Object.keys(JSON.parse(json)).join(', ')}`)
    await wipeUserData()
    expect(await db.sessions.count()).toBe(0)
    const r = await importData(parseBackup(json))
    console.log('import:', JSON.stringify(r))
    expect(await db.sessions.get(sessionId)).toEqual(before)
    expect(allWeeks((await getActiveProgram())!)[0].days.map((d) => d.key)).toEqual(['A1', 'B1', 'C1'])
    expect((await getProfile())?.level).toBe('intermediario')
    expect(await db.exercises.count()).toBe(1324)
  })

  it('rejeita arquivos inválidos com mensagem amigável', async () => {
    const good = JSON.parse(JSON.stringify(await exportData()))
    const cases: [string, string][] = [
      ['não é json', '{oops'],
      ['outro app', JSON.stringify({ app: 'strong', data: [] })],
      ['versão futura', JSON.stringify({ ...good, format: 99 })],
      ['série com reps texto', JSON.stringify({ ...good, sessions: [{ ...good.sessions[0], exercises: [{ ...good.sessions[0].exercises[0], log: [{ weight: 60, reps: 'doze', rpe: null, done: true }] }] }] })],
    ]
    for (const [label, text] of cases) {
      let msg = ''
      try {
        parseBackup(text)
      } catch (e) {
        expect(e).toBeInstanceOf(BackupError)
        msg = (e as Error).message
      }
      console.log(`${label} → "${msg}"`)
      expect(msg).not.toBe('')
    }
    expect(await db.sessions.count()).toBe(1)
  })
})
