import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from './__fixtures__/load'
import { CURATED } from './curated'
import { EQUIPMENT_PT, MUSCLE_PT } from './i18n'
import { EMPTY_FILTER, filterCatalog } from './search'

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))

describe('catálogo curado', () => {
  it('todo id curado existe no dataset', () => {
    const missing = CURATED.filter((c) => !byId.has(c.id)).map((c) => c.id)
    expect(missing).toEqual([])
  })

  it('não tem ids duplicados', () => {
    expect(new Set(CURATED.map((c) => c.id)).size).toBe(CURATED.length)
  })

  it('recebe o nome em pt-BR', () => {
    expect(byId.get('0025')?.namePt).toBe('Supino reto com barra')
    expect(byId.get('0001')?.namePt).toBeUndefined()
  })

  it('corrige o "°" corrompido de alguns nomes', () => {
    expect(byId.get('0739')?.name).toBe('sled 45° leg press')
  })
})

describe('traduções', () => {
  it('todo equipamento do dataset tem tradução', () => {
    const missing = [...new Set(catalog.map((e) => e.equipment))].filter((x) => !EQUIPMENT_PT[x])
    expect(missing).toEqual([])
  })

  it('todo músculo (alvo, sinergista e secundário) tem tradução', () => {
    const all = new Set(catalog.flatMap((e) => [e.target, e.muscleGroup, ...e.secondary]))
    expect([...all].filter((m) => !MUSCLE_PT[m])).toEqual([])
  })
})

describe('filterCatalog', () => {
  it('por padrão mostra só os curados', () => {
    expect(filterCatalog(catalog, EMPTY_FILTER)).toHaveLength(CURATED.length)
  })

  it('busca ignora acento e casa pt ou inglês', () => {
    const f = { ...EMPTY_FILTER, onlyCurated: false }
    expect(filterCatalog(catalog, { ...f, query: 'elevacao lateral' }).map((e) => e.id)).toContain('0334')
    expect(filterCatalog(catalog, { ...f, query: 'lateral raise' }).map((e) => e.id)).toContain('0334')
  })

  it('filtra por grupo e equipamento e põe curados primeiro', () => {
    const r = filterCatalog(catalog, { ...EMPTY_FILTER, onlyCurated: false, bodyPart: 'chest', equipment: 'dumbbell' })
    expect(r.length).toBeGreaterThan(5)
    expect(r.every((e) => e.bodyPart === 'chest' && e.equipment === 'dumbbell')).toBe(true)
    expect(r[0].namePt).toBeDefined()
  })
})
