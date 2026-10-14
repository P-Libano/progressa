import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { ADVANCED_IDS, CURATED_BY_ID, NEEDS_BAR_IDS, type MuscleGroup } from '../data/curated'
import { formatRoutine } from './format'
import { generateRoutine, nextDayKey, type Routine } from './generator'
import { PRESCRIPTION } from './prescription'
import {
  EQUIPMENT_SETS,
  SPLIT_DAY_KEYS,
  hasPullupBar,
  type EquipmentAccess,
  type Goal,
  type Level,
  type Profile,
  type Split,
} from './profile'

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))
const equipmentOf = (id: string) => byId.get(id)?.equipment
const nameOf = (id: string) => byId.get(id)?.namePt ?? byId.get(id)?.name ?? id

const LARGE: Record<string, MuscleGroup[]> = {
  peito: ['peito'],
  costas: ['costas'],
  pernas: ['quadriceps', 'posteriores', 'gluteos'],
  ombros: ['ombros'],
}

/** Todas as violações das regras do gerador; vazio = ok. */
function violations(r: Routine): string[] {
  const v: string[] = []
  const allowed = EQUIPMENT_SETS[r.profile.equipment]
  for (const d of r.days) {
    const ids = d.exercises.map((e) => e.exerciseId)
    for (const id of ids) {
      if (!allowed.has(equipmentOf(id)!)) v.push(`${d.key}: ${nameOf(id)} usa ${equipmentOf(id)}`)
      if (!hasPullupBar(r.profile) && NEEDS_BAR_IDS.has(id)) v.push(`${d.key}: ${nameOf(id)} precisa de barra`)
    }
    if (new Set(ids).size !== ids.length) v.push(`${d.key}: exercício repetido`)
    const firstIso = d.exercises.findIndex((e) => !e.compound)
    if (firstIso >= 0 && d.exercises.slice(firstIso).some((e) => e.compound)) v.push(`${d.key}: composto depois de isolador`)
    if (d.exercises.length < 4 || d.exercises.length > 6) v.push(`${d.key}: ${d.exercises.length} exercícios`)
    for (const e of d.exercises) {
      const p = PRESCRIPTION[r.profile.goal][r.profile.level][e.compound ? 'compound' : 'isolation']
      if (e.sets !== p.sets || e.repMin !== p.repMin || e.repMax !== p.repMax) v.push(`${d.key}: prescrição errada em ${nameOf(e.exerciseId)}`)
    }
  }
  // cobertura dos grupos grandes ao longo da rotação completa
  const trained = new Set(r.days.flatMap((d) => d.exercises.map((e) => e.group)))
  for (const [label, groups] of Object.entries(LARGE)) {
    if (!groups.some((g) => trained.has(g))) v.push(`grupo grande ausente: ${label}`)
  }
  return v
}

function weeklyCoverage(r: Routine) {
  const weekKeys = new Set(r.schedule)
  const trained = new Set(r.days.filter((d) => weekKeys.has(d.key)).flatMap((d) => d.exercises.map((e) => e.group)))
  return Object.fromEntries(
    Object.entries(LARGE).map(([label, groups]) => [label, groups.some((g) => trained.has(g))]),
  )
}

const CASES: [string, Profile][] = [
  ['a) ABC, 3x, hipertrofia, academia, intermediário', { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }],
  ['b) AB, 4x, hipertrofia, só halteres, iniciante', { split: 'AB', daysPerWeek: 4, goal: 'hipertrofia', equipment: 'halteres', level: 'iniciante' }],
  ['c) Full body, 3x, força, peso corporal, iniciante', { split: 'full_body', daysPerWeek: 3, goal: 'forca', equipment: 'peso_corporal', level: 'iniciante' }],
]

describe('generateRoutine — perfis da checklist', () => {
  for (const [label, profile] of CASES) {
    it(label, () => {
      const r = generateRoutine(profile, equipmentOf, 0)
      console.log(`\n=== ${label} ===\n${formatRoutine(r, nameOf, (id) => equipmentOf(id)!)}`)
      console.log('cobertura semanal:', JSON.stringify(weeklyCoverage(r)))
      const v = violations(r)
      console.log('violações:', v.length ? v : 'nenhuma')
      expect(v).toEqual([])
      expect(Object.values(weeklyCoverage(r)).every(Boolean)).toBe(true)
    })
  }

  it('a semana segue a divisão (AB 4x → A B A B)', () => {
    expect(generateRoutine(CASES[1][1], equipmentOf, 0).schedule).toEqual(['A', 'B', 'A', 'B'])
  })

  it('é determinístico', () => {
    const p = CASES[0][1]
    expect(generateRoutine(p, equipmentOf, 0)).toEqual(generateRoutine(p, equipmentOf, 0))
  })

  it('iniciante não recebe exercício avançado quando há alternativa', () => {
    for (const p of [{ ...CASES[0][1], level: 'iniciante' as const }, CASES[2][1]]) {
      const ids = generateRoutine(p, equipmentOf, 0).days.flatMap((d) => d.exercises.map((e) => e.exerciseId))
      expect(ids.filter((id) => ADVANCED_IDS.has(id)).map(nameOf)).toEqual([])
    }
  })

  it('não repete o mesmo padrão com o mesmo equipamento no dia (academia)', () => {
    const r = generateRoutine(CASES[0][1], equipmentOf, 0)
    for (const d of r.days) {
      const sig = d.exercises.map((e) => `${CURATED_BY_ID.get(e.exerciseId)!.pattern}|${equipmentOf(e.exerciseId)}`)
      expect(new Set(sig).size, d.name).toBe(sig.length)
    }
  })

  it('com equipamento, prefere carga a peso corporal', () => {
    const r = generateRoutine(CASES[0][1], equipmentOf, 0)
    const bw = r.days.flatMap((d) => d.exercises).filter((e) => equipmentOf(e.exerciseId) === 'body weight')
    expect(bw.map((e) => nameOf(e.exerciseId))).toEqual([])
  })

  it('só halteres sem barra fixa não usa barra fixa nem paralelas', () => {
    const r = generateRoutine(CASES[1][1], equipmentOf, 0)
    const ids = r.days.flatMap((d) => d.exercises.map((e) => e.exerciseId))
    expect(ids.filter((id) => NEEDS_BAR_IDS.has(id)).map(nameOf)).toEqual([])
  })

  it('peso corporal sem barra: completa o dia e avisa', () => {
    const r = generateRoutine(
      { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'peso_corporal', level: 'intermediario', pullupBar: false },
      equipmentOf,
      0,
    )
    console.log(`\n=== ABC 3x peso corporal SEM barra ===\n${formatRoutine(r, nameOf, (id) => equipmentOf(id)!)}`)
    expect(violations(r)).toEqual([])
    expect(r.warnings.some((w) => w.includes('barra fixa'))).toBe(true)
  })

  it('nextDayKey roda em sequência', () => {
    const r = generateRoutine(CASES[0][1], equipmentOf, 0)
    expect([undefined, 'A', 'B', 'C'].map((k) => nextDayKey(r, k))).toEqual(['A', 'B', 'C', 'A'])
  })
})

describe('generateRoutine — todas as combinações de perfil', () => {
  const splits = Object.keys(SPLIT_DAY_KEYS) as Split[]
  const equips: EquipmentAccess[] = ['academia', 'halteres', 'peso_corporal']
  const levels: Level[] = ['iniciante', 'intermediario', 'avancado']
  const goals: Goal[] = ['hipertrofia', 'forca']
  const all: [string, Profile][] = []
  for (const split of splits)
    for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
      for (const equipment of equips)
        for (const level of levels)
          for (const goal of goals)
            for (const pullupBar of [true, false])
              all.push([
                `${split} ${daysPerWeek}x ${equipment} ${level} ${goal} barra=${pullupBar}`,
                { split, daysPerWeek, equipment, level, goal, pullupBar },
              ])

  it(`${all.length} perfis sem violação`, () => {
    const failures = all
      .map(([label, p]) => [label, violations(generateRoutine(p, equipmentOf, 0))] as const)
      .filter(([, v]) => v.length)
    if (failures.length) console.log(failures.slice(0, 20).map(([l, v]) => `${l}: ${v.join('; ')}`).join('\n'))
    expect(failures.length).toBe(0)
  })

  it('cobertura semanal completa sempre que os dias cobrem a divisão', () => {
    const gaps = all
      .filter(([, p]) => p.split === 'full_body' || p.daysPerWeek >= SPLIT_DAY_KEYS[p.split].length)
      .map(([label, p]) => [label, weeklyCoverage(generateRoutine(p, equipmentOf, 0))] as const)
      .filter(([, c]) => !Object.values(c).every(Boolean))
    if (gaps.length) console.log(gaps.slice(0, 20).map(([l, c]) => `${l}: ${JSON.stringify(c)}`).join('\n'))
    expect(gaps.length).toBe(0)
  })
})
