import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { ensureCatalog } from '../data/catalog'
import type { Exercise } from '../data/types'
import { db } from '../db'

export type CatalogStatus = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string }

/** Baixa/valida o catálogo uma vez por sessão do app. */
export function useCatalogBootstrap() {
  const [status, setStatus] = useState<CatalogStatus>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setStatus({ state: 'loading' })
    ensureCatalog()
      .then(() => alive && setStatus({ state: 'ready' }))
      .catch((e: unknown) =>
        alive && setStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      alive = false
    }
  }, [attempt])

  return { status, retry: () => setAttempt((n) => n + 1) }
}

/** Lista completa (≈1.300 itens), reativa ao IndexedDB. */
export function useExercises(): Exercise[] | undefined {
  return useLiveQuery(() => db.exercises.toArray(), [])
}

export function useExerciseMap(): Map<string, Exercise> | undefined {
  const list = useExercises()
  return useMemo(() => (list ? new Map(list.map((e) => [e.id, e])) : undefined), [list])
}

export function useExercise(id: string | undefined) {
  return useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id])
}
