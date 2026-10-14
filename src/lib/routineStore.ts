import { useLiveQuery } from 'dexie-react-hooks'
import { META, db } from '../db'
import { generateRoutine, swapExercise, type Routine } from '../domain/generator'
import type { Profile } from '../domain/profile'

export async function getProfile(): Promise<Profile | undefined> {
  return (await db.meta.get(META.profile))?.value as Profile | undefined
}

export async function getActiveRoutine(): Promise<Routine | undefined> {
  const id = (await db.meta.get(META.activeRoutine))?.value as number | undefined
  return id === undefined ? undefined : db.routines.get(id)
}

/** Salva o perfil, gera a rotina local e a torna ativa. */
export async function saveProfileAndGenerate(profile: Profile): Promise<Routine> {
  const equipment = new Map<string, string>()
  await db.exercises.each((e) => equipment.set(e.id, e.equipment))
  const routine = generateRoutine(profile, (id) => equipment.get(id))
  return db.transaction('rw', db.meta, db.routines, async () => {
    await db.meta.put({ key: META.profile, value: profile })
    const id = (await db.routines.add(routine)) as number
    await db.meta.put({ key: META.activeRoutine, value: id })
    return { ...routine, id }
  })
}

/** Ativa uma rotina já pronta (ex.: vinda da IA). */
export async function activateRoutine(routine: Routine): Promise<number> {
  return db.transaction('rw', db.meta, db.routines, async () => {
    await db.meta.put({ key: META.profile, value: routine.profile })
    const { id: _ignored, ...rest } = routine
    const id = (await db.routines.add(rest)) as number
    await db.meta.put({ key: META.activeRoutine, value: id })
    return id
  })
}

export async function replaceExercise(routineId: number, dayKey: string, index: number, newId: string) {
  const r = await db.routines.get(routineId)
  if (!r) return
  await db.routines.put(swapExercise(r, dayKey, index, newId))
}

export const useProfile = () => useLiveQuery(getProfile, [])
/** `null` = carregado e sem rotina; `undefined` = carregando. */
export const useActiveRoutine = () => useLiveQuery(async () => (await getActiveRoutine()) ?? null, [])
