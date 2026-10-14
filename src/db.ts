import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from './data/types'

export interface MetaRow {
  key: string
  value: unknown
}

export class ProgressaDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'progressa') {
    super(name)
    this.version(1).stores({
      exercises: 'id, bodyPart, equipment, target',
      meta: 'key',
    })
  }
}

export const db = new ProgressaDB()
