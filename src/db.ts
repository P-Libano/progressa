import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from './data/types'
import type { Routine } from './domain/generator'
import type { Session } from './domain/session'

export interface MetaRow {
  key: string
  value: unknown
}

export class ProgressaDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  meta!: EntityTable<MetaRow, 'key'>
  routines!: EntityTable<Routine, 'id'>
  sessions!: EntityTable<Session, 'id'>

  constructor(name = 'progressa') {
    super(name)
    this.version(1).stores({
      exercises: 'id, bodyPart, equipment, target',
      meta: 'key',
    })
    this.version(2).stores({
      routines: '++id, createdAt',
    })
    this.version(3).stores({
      sessions: '++id, startedAt, status, *exerciseIds',
    })
  }
}

export const db = new ProgressaDB()

/** Chaves usadas na tabela meta. */
export const META = {
  catalog: 'catalog',
  profile: 'profile',
  activeRoutine: 'activeRoutine',
} as const
