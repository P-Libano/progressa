import { useLiveQuery } from 'dexie-react-hooks'
import { META, db } from '../db'

/** Chave da Claude API: fica só no IndexedDB deste aparelho e nunca entra no backup. */

export async function getApiKey(): Promise<string | undefined> {
  return (await db.meta.get(META.apiKey))?.value as string | undefined
}

export async function setApiKey(key: string) {
  await db.meta.put({ key: META.apiKey, value: key.trim() })
}

export async function clearApiKey() {
  await db.meta.delete(META.apiKey)
}

/** `null` = sem chave; `undefined` = carregando. */
export const useApiKey = () => useLiveQuery(async () => (await getApiKey()) ?? null, [])

export const maskKey = (k: string) => (k.length <= 12 ? '••••' : `${k.slice(0, 10)}…${k.slice(-4)}`)
