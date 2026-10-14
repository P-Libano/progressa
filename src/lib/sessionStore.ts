import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Routine } from '../domain/generator'
import { buildSession, type Session, type SetLog } from '../domain/session'

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first()
}

/** Retoma a sessão em andamento ou cria a do dia pedido. */
export async function startOrResume(routine: Routine, dayKey: string, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.sessions, async () => {
    const active = await getActiveSession()
    if (active) return active.id!
    const ids = routine.days.find((d) => d.key === dayKey)?.exercises.map((e) => e.exerciseId) ?? []
    const past = await db.sessions.where('exerciseIds').anyOf(ids).distinct().toArray()
    return (await db.sessions.add(buildSession(routine, dayKey, past, now))) as number
  })
}

async function mutate(id: number, fn: (s: Session) => void) {
  await db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id)
    if (!s) return
    fn(s)
    await db.sessions.put(s)
  })
}

export const updateSet = (id: number, ex: number, set: number, patch: Partial<SetLog>) =>
  mutate(id, (s) => {
    Object.assign(s.exercises[ex].log[set], patch)
  })

/** Marca/desmarca a série. Ao concluir, inicia o descanso do exercício. */
export const toggleSetDone = (id: number, ex: number, set: number, now = Date.now()) =>
  mutate(id, (s) => {
    const e = s.exercises[ex]
    const log = e.log[set]
    log.done = !log.done
    if (log.done) {
      if (log.reps === null) log.reps = e.repMax // marcar sem digitar = fez o alvo
      s.restUntil = now + e.restSec * 1000
      s.restTotal = e.restSec
    }
  })

export const addSet = (id: number, ex: number) =>
  mutate(id, (s) => {
    const log = s.exercises[ex].log
    const last = log[log.length - 1]
    log.push({ weight: last?.weight ?? null, reps: null, done: false })
  })

export const removeLastSet = (id: number, ex: number) =>
  mutate(id, (s) => {
    const log = s.exercises[ex].log
    if (log.length > 1 && !log[log.length - 1].done) log.pop()
  })

/** Propaga a carga para as séries seguintes ainda não feitas. */
export const setWeightFrom = (id: number, ex: number, set: number, weight: number | null) =>
  mutate(id, (s) => {
    s.exercises[ex].log.forEach((l, i) => {
      if (i === set || (i > set && !l.done)) l.weight = weight
    })
  })

export const setRest = (id: number, until: number | undefined, total?: number) =>
  mutate(id, (s) => {
    s.restUntil = until
    if (total !== undefined) s.restTotal = total
  })

export const finishSession = (id: number, now = Date.now()) =>
  mutate(id, (s) => {
    s.status = 'done'
    s.finishedAt = now
    s.restUntil = undefined
  })

export const discardSession = (id: number) => db.sessions.delete(id)

/** Última sessão concluída da rotina (define o próximo dia). */
export async function lastDoneSession(routineId: number): Promise<Session | undefined> {
  const done = await db.sessions.where('status').equals('done').toArray()
  return done.filter((s) => s.routineId === routineId).sort((a, b) => b.startedAt - a.startedAt)[0]
}

export const useActiveSession = () => useLiveQuery(async () => (await getActiveSession()) ?? null, [])
export const useSession = (id: number | undefined) =>
  useLiveQuery(async () => (id === undefined ? null : ((await db.sessions.get(id)) ?? null)), [id])
export const useLastDoneSession = (routineId: number | undefined) =>
  useLiveQuery(async () => (routineId === undefined ? null : ((await lastDoneSession(routineId)) ?? null)), [routineId])
