import { describe, expect, it } from 'vitest'
import { contaFor, estimate1rm, fromReference, kgAtPct, kgForReps, latestEstimate, targetKg } from '../../src/programacao/progression/carga'
import type { ExerciseResultV2 } from '../../src/programacao/types'

const result = (weekKind: ExerciseResultV2['weekKind'], weight: number, reps: number[], rpe: number | null = null): ExerciseResultV2 => ({
  date: 0,
  weekKind,
  prescription: { exerciseId: '0025', role: 'composto', group: 'peito', sets: reps.length, reps: { min: 8, max: 12 }, restSec: 90 },
  sets: reps.map((r) => ({ weight, reps: r, rpe, restBeforeSec: null })),
})

describe('1RM estimado', () => {
  it('Epley com reps em reserva pelo RPE', () => {
    // 60 × 8 em RPE 8 = 60 × (1 + 10/30) = 80
    const e = estimate1rm([
      { weight: 60, reps: 8, rpe: 8 },
      { weight: 60, reps: 6, rpe: 9 },
    ])
    expect(e).toEqual({ e1rm: 80, weight: 60, reps: 8, rpe: 8 })
  })

  it('ignora séries acima de 12 reps quando há outra mais pesada', () => {
    expect(estimate1rm([{ weight: 50, reps: 20 }, { weight: 60, reps: 5 }])?.e1rm).toBe(70)
    expect(estimate1rm([{ weight: 30, reps: 20 }])?.e1rm).toBe(50) // só há essa: usa
  })

  it('peso corporal não tem 1RM', () => {
    expect(estimate1rm([{ weight: 0, reps: 10 }])).toBeNull()
  })

  it('deload não entra na estimativa', () => {
    expect(latestEstimate([result('carga', 60, [10, 10]), result('deload', 40, [10, 10])])?.e1rm).toBe(80)
  })
})

describe('de volta para kg', () => {
  it('Epley invertido e %1RM, arredondados a 0,5', () => {
    expect(kgForReps(80, 10, 8)).toBe(57) // 80 / 1,4 = 57,14
    expect(kgAtPct(100, 82.5)).toBe(82.5)
  })

  it('faixa da prescrição: por %1RM ou por reps + RPE', () => {
    expect(targetKg(100, { pct1rm: { min: 80, max: 85 } })).toEqual({ min: 80, max: 85 })
    // leve: 12 reps em RPE 7 (80/1,5) · pesada: 8 reps em RPE 9 (80/1,3)
    expect(targetKg(80, { reps: { min: 8, max: 12 }, rpe: { min: 7, max: 9 } })).toEqual({ min: 53.5, max: 61.5 })
  })

  it('referência informada → carga de partida', () => {
    const r = fromReference({ weight: 40, reps: 10 }, { reps: { min: 8, max: 12 }, rpe: { min: 7, max: 9 } })!
    console.log('referência 40×10 (8–12, RPE 7–9):', r.text)
    expect(r.kg).toBe(38)
    expect(fromReference({ weight: 100, reps: 1 }, { pct1rm: { min: 80, max: 80 } })!.kg).toBe(80)
    expect(fromReference({ weight: 0, reps: 10 }, { reps: { min: 8, max: 12 } })).toBeNull()
  })

  it('a conta mostrada no treino', () => {
    const c = contaFor([result('carga', 60, [10, 10, 9])], { pct1rm: { min: 75, max: 80 } }, 62.5)!
    console.log('conta:', c.lines)
    expect(c.estimate.e1rm).toBe(80)
    expect(c.target).toEqual({ min: 60, max: 64 })
    expect(c.lines).toHaveLength(3)
    expect(c.lines[2]).toContain('78%')
  })
})
