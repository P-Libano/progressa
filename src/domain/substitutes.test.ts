import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { CURATED_BY_ID, NEEDS_BAR_IDS } from '../data/curated'
import { equipmentPt, musclePt } from '../data/i18n'
import { EQUIPMENT_SETS, type Profile } from './profile'
import { SUBSTITUTE_REASON_PT, suggestSubstitutes } from './substitutes'

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))

const gym: Profile = { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }

describe('suggestSubstitutes', () => {
  it('Supino reto com barra (academia): mesmo músculo primário e equipamento disponível', () => {
    const base = byId.get('0025')!
    const subs = suggestSubstitutes('0025', catalog, gym)
    console.log(`\nSubstitutos de "${base.namePt}" [${musclePt(base.target)} · ${equipmentPt(base.equipment)}]:`)
    subs.forEach((s, i) =>
      console.log(
        `  ${String(i + 1).padStart(2)}. ${s.exercise.namePt ?? s.exercise.name} — ${musclePt(s.exercise.target)} · ` +
          `${equipmentPt(s.exercise.equipment)} · ${SUBSTITUTE_REASON_PT[s.reason]}`,
      ),
    )
    expect(subs.length).toBeGreaterThanOrEqual(5)
    expect(subs.every((s) => s.exercise.target === base.target)).toBe(true)
    expect(subs.every((s) => EQUIPMENT_SETS.academia.has(s.exercise.equipment))).toBe(true)
    expect(subs.map((s) => s.exercise.id)).not.toContain('0025')
    // o primeiro é o mesmo movimento (empurrar horizontal), não um crucifixo
    expect(CURATED_BY_ID.get(subs[0].exercise.id)?.pattern).toBe('empurrar_horizontal')
  })

  it('respeita o equipamento do perfil (só halteres, sem barra)', () => {
    const p: Profile = { ...gym, equipment: 'halteres' }
    const subs = suggestSubstitutes('0025', catalog, p)
    expect(subs.length).toBeGreaterThan(0)
    expect(subs.every((s) => ['dumbbell', 'body weight'].includes(s.exercise.equipment))).toBe(true)
    expect(subs.some((s) => NEEDS_BAR_IDS.has(s.exercise.id))).toBe(false)
  })

  it('exclui o que já está no dia', () => {
    const subs = suggestSubstitutes('0025', catalog, gym, new Set(['0289']))
    expect(subs.map((s) => s.exercise.id)).not.toContain('0289')
  })

  it('agachamento: substitutos curados são de quadríceps, não de glúteo', () => {
    const subs = suggestSubstitutes('0043', catalog, gym).filter((s) => s.reason !== 'mesmo_musculo')
    console.log(`\nSubstitutos curados de "Agachamento livre com barra": ${subs.map((s) => s.exercise.namePt).join(', ')}`)
    expect(subs.every((s) => CURATED_BY_ID.get(s.exercise.id)?.group === 'quadriceps')).toBe(true)
  })

  it('não sugere alongamentos', () => {
    const subs = suggestSubstitutes('0605', catalog, gym, new Set(), 50)
    expect(subs.filter((s) => /stretch/i.test(s.exercise.name))).toEqual([])
  })
})
