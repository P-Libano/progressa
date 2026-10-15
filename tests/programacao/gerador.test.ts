import { describe, expect, it } from 'vitest'
import { NEEDS_BAR_IDS } from '../../src/data/curated'
import { EQUIPMENT_SETS, hasPullupBar } from '../../src/domain/profile'
import { findUnfoundedClaims } from '../../src/lib/claims'
import { generateProgram } from '../../src/programacao/generator'
import { GOALS } from '../../src/programacao/goals'
import { allWeeks, nextPosition, swapInProgram } from '../../src/programacao/program'
import { GOAL_IDS, type Program, type UserProfile } from '../../src/programacao/types'
import { equipmentOf, firstLoadWeek, gen, nameOf } from './helpers'

const ALL: UserProfile[] = []
for (const goal of GOAL_IDS)
  for (const split of ['AB', 'ABC', 'ABCD', 'upper_lower', 'full_body'] as const)
    for (let daysPerWeek = 2; daysPerWeek <= 6; daysPerWeek++)
      for (const equipment of ['academia', 'halteres', 'peso_corporal'] as const)
        for (const level of ['iniciante', 'intermediario', 'avancado'] as const)
          for (const pullupBar of [true, false]) ALL.push({ goal, split, daysPerWeek, equipment, level, pullupBar })

/** Violações estruturais do programa; vazio = ok. */
function violations(p: Program): string[] {
  const v: string[] = []
  const allowed = EQUIPMENT_SETS[p.profile.equipment]
  for (const w of allWeeks(p))
    for (const d of w.days) {
      const it = d.groups.flatMap((g) => g.items)
      const strength = it.filter((i) => i.role !== 'condicionamento')
      for (const i of it) {
        if (!allowed.has(equipmentOf(i.exerciseId)!)) v.push(`${d.key}: ${nameOf(i.exerciseId)} usa ${equipmentOf(i.exerciseId)}`)
        if (!hasPullupBar(p.profile) && NEEDS_BAR_IDS.has(i.exerciseId)) v.push(`${d.key}: ${nameOf(i.exerciseId)} precisa de barra`)
      }
      const ids = it.map((i) => i.exerciseId)
      if (new Set(ids).size !== ids.length) v.push(`S${w.index} ${d.key}: exercício repetido`)
      if (w.kind === 'carga' && (strength.length < 4 || strength.length > 6)) v.push(`S${w.index} ${d.key}: ${strength.length} exercícios de força`)
      const pi = strength.findIndex((i) => i.role === 'principal')
      if (pi > 0) v.push(`${d.key}: principal fora do 1º lugar`)
      // nenhum grupo com composto depois de um grupo só de isoladores
      let isoOnlySeen = false
      for (const g of d.groups.filter((x) => x.kind !== 'finisher')) {
        const hasComp = g.items.some((i) => i.role === 'principal' || i.role === 'composto')
        if (isoOnlySeen && hasComp) v.push(`${d.key}: composto depois de isolador`)
        if (!hasComp) isoOnlySeen = true
      }
      const fi = d.groups.findIndex((g) => g.kind === 'finisher')
      if (fi >= 0 && fi !== d.groups.length - 1) v.push(`${d.key}: finisher fora do fim`)
    }
  const kinds = allWeeks(p).map((w) => w.kind)
  if (kinds.at(-1) !== 'deload' || kinds.filter((k) => k === 'deload').length !== 1) v.push(`semanas ${kinds.join(',')}`)
  if (!p.explanation || findUnfoundedClaims(p.explanation).length) v.push('explicação vazia ou com promessa sem base')
  return v
}

describe('gerador v2 — todas as combinações de perfil', () => {
  it(`${ALL.length} perfis geram programas sem violação`, () => {
    const failures: string[] = []
    for (const prof of ALL) {
      const label = `${prof.goal} ${prof.split} ${prof.daysPerWeek}x ${prof.equipment} ${prof.level} barra=${prof.pullupBar}`
      try {
        const v = violations(generateProgram(prof, equipmentOf, 0))
        if (v.length) failures.push(`${label}: ${v.slice(0, 2).join('; ')}`)
      } catch (e) {
        failures.push(`${label}: ERRO ${(e as Error).message}`)
      }
    }
    if (failures.length) console.log(failures.slice(0, 25).join('\n'))
    expect(failures).toEqual([])
  })

  it('cobertura semanal dos grupos grandes (peito, costas, pernas, ombros) em todos os objetivos com academia', () => {
    const gaps: string[] = []
    for (const prof of ALL.filter((p) => p.equipment === 'academia' && p.pullupBar)) {
      const p = generateProgram(prof, equipmentOf, 0)
      const trained = new Set(allWeeks(p).slice(0, 2).flatMap((w) => w.days.flatMap((d) => d.groups.flatMap((g) => g.items.map((i) => i.group)))))
      for (const [label, groups] of [['peito', ['peito']], ['costas', ['costas']], ['pernas', ['quadriceps', 'posteriores']], ['ombros', ['ombros']]] as const)
        if (!groups.some((g) => trained.has(g))) gaps.push(`${prof.goal} ${prof.split} ${prof.daysPerWeek}x ${prof.level}: sem ${label}`)
    }
    if (gaps.length) console.log(gaps.slice(0, 20).join('\n'))
    expect(gaps).toEqual([])
  })

  it('volume fora da faixa sempre vem com aviso', () => {
    const silent: string[] = []
    for (const prof of ALL) {
      const p = generateProgram(prof, equipmentOf, 0)
      for (const [g, r] of Object.entries(GOALS[prof.goal].weeklySets)) {
        const v = p.weeklyVolume[g as keyof typeof p.weeklyVolume] ?? 0
        if ((v < r!.min || v > r!.max) && !p.warnings.some((w) => w.includes(`Volume de ${g}`))) silent.push(`${prof.goal}/${prof.split}/${prof.daysPerWeek}: ${g}=${v}`)
      }
    }
    expect(silent).toEqual([])
  })

  it('é determinístico', () => {
    expect(gen({ goal: 'forca' })).toEqual(gen({ goal: 'forca' }))
  })

  it('força: dias com a mesma letra variam o principal (supino/desenvolvimento, agachamento/terra)', () => {
    const w = firstLoadWeek(gen({ goal: 'forca' }))
    const principals = w.days.map((d) => `${d.key}:${nameOf(d.groups[0].items[0].exerciseId)}`)
    console.log('principais:', principals.join(', '))
    expect(new Set(w.days.map((d) => d.groups[0].items[0].exerciseId)).size).toBe(4)
  })

  it('próximo treino percorre a semana e vira para a próxima; volta à semana 1 no fim do ciclo', () => {
    const p = gen({ goal: 'forca' })
    const ws = allWeeks(p)
    expect(nextPosition(p)).toEqual({ weekIndex: 1, dayIndex: 0 })
    expect(nextPosition(p, { weekIndex: 1, dayKey: ws[0].days[0].key })).toEqual({ weekIndex: 1, dayIndex: 1 })
    expect(nextPosition(p, { weekIndex: 1, dayKey: ws[0].days.at(-1)!.key })).toEqual({ weekIndex: 2, dayIndex: 0 })
    expect(nextPosition(p, { weekIndex: 4, dayKey: ws[3].days.at(-1)!.key })).toEqual({ weekIndex: 1, dayIndex: 0 })
  })

  it('troca de exercício vale para todas as semanas e represcreve quando o papel muda', () => {
    const p = { ...gen({ goal: 'forca' }), id: 1 }
    const day = firstLoadWeek(p).days[0]
    // supino (principal 3–5) → afundo com halteres: não serve para < 6 reps
    const swapped = swapInProgram(p, day.key, 0, 0, '0336', equipmentOf)
    const items = allWeeks(swapped).map((w) => w.days.find((d) => d.key === day.key)!.groups[0].items[0])
    expect(items.every((i) => i.exerciseId === '0336')).toBe(true)
    expect(items.every((i) => (i.reps?.min ?? 0) >= 6)).toBe(true)
  })
})
