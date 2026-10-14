import { describe, expect, it } from 'vitest'
import type { MuscleGroup } from '../data/curated'
import { fmtReps, suggestNext, workingWeight, type ExerciseResult, type Target } from './progression'

const T: Target = { sets: 3, repMin: 8, repMax: 12 }
const session = (day: number, weight: number, reps: number[]): ExerciseResult => ({
  date: day,
  sets: reps.map((r) => ({ weight, reps: r })),
})

/** Roda a sequência, imprime o estado após cada sessão e devolve a última sugestão. */
function simulate(label: string, group: MuscleGroup, sessions: ExerciseResult[]) {
  console.log(`\n=== ${label} (${group}) ===`)
  const history: ExerciseResult[] = []
  let s = suggestNext(history, T, group)
  console.log(`antes da 1ª sessão → ${JSON.stringify(s)}`)
  sessions.forEach((r, i) => {
    history.push(r)
    s = suggestNext(history, T, group)
    console.log(
      `sessão ${i + 1}: ${workingWeight(r)} kg × ${fmtReps(r)} → próxima: ${s.weight} kg ` +
        `[${s.kind}, falhas seguidas=${s.failStreak}] "${s.reason}"`,
    )
  })
  return s
}

describe('progressão — cenários da checklist', () => {
  it('Supino 3x8–12 a 60 kg, 12/12/12 → 62,5 kg', () => {
    const s = simulate('Supino', 'peito', [session(1, 60, [12, 12, 12])])
    expect(s).toMatchObject({ kind: 'increase', weight: 62.5 })
  })

  it('Agachamento 3x8–12 a 80 kg, 12/12/12 → 85 kg', () => {
    const s = simulate('Agachamento', 'quadriceps', [session(1, 80, [12, 12, 12])])
    expect(s).toMatchObject({ kind: 'increase', weight: 85 })
  })

  it('Supino 60 kg, 10/9/8 e depois 9/8/7 → deload 54 kg', () => {
    const s = simulate('Supino', 'peito', [session(1, 60, [10, 9, 8]), session(2, 60, [9, 8, 7])])
    expect(s).toMatchObject({ kind: 'deload', weight: 54 })
  })

  it('Supino 60 kg, 12/12/11 → mantém 60 kg', () => {
    const s = simulate('Supino', 'peito', [session(1, 60, [12, 12, 11])])
    expect(s).toMatchObject({ kind: 'keep', weight: 60 })
  })
})

describe('progressão — regras', () => {
  it('quem melhora dentro da faixa não leva deload (10/9/8 → 11/10/9)', () => {
    const s = simulate('Supino progredindo', 'peito', [session(1, 60, [10, 9, 8]), session(2, 60, [11, 10, 9])])
    expect(s).toMatchObject({ kind: 'keep', weight: 60, failStreak: 0 })
  })

  it('estagnar 2 sessões na mesma carga gera deload', () => {
    const s = simulate('Supino estagnado', 'peito', [
      session(1, 60, [10, 9, 8]),
      session(2, 60, [11, 10, 9]),
      session(3, 60, [11, 10, 9]),
      session(4, 60, [10, 10, 9]),
    ])
    expect(s).toMatchObject({ kind: 'deload', weight: 54 })
  })

  it('ciclo completo: sobe, estagna, faz deload e volta a subir', () => {
    const s = simulate('Ciclo', 'peito', [
      session(1, 60, [12, 12, 12]),
      session(2, 62.5, [9, 8, 8]),
      session(3, 62.5, [9, 8, 7]),
      session(4, 56.5, [12, 12, 12]),
    ])
    expect(s).toMatchObject({ kind: 'increase', weight: 59 })
  })

  it('série faltando não conta como topo', () => {
    const s = suggestNext([session(1, 60, [12, 12])], T, 'peito')
    expect(s.kind).not.toBe('increase')
  })

  it('séries extras além do planejado não atrapalham o topo', () => {
    const s = suggestNext([session(1, 60, [12, 12, 12, 8])], T, 'peito')
    expect(s).toMatchObject({ kind: 'increase', weight: 62.5 })
  })

  it('deload arredonda a 0,5 kg', () => {
    const s = suggestNext([session(1, 47.5, [8, 7, 6]), session(2, 47.5, [8, 7, 5])], T, 'peito')
    expect(s.weight).toBe(43) // 42,75 → 43
  })

  it('sem histórico pede carga inicial', () => {
    expect(suggestNext([], T, 'peito')).toMatchObject({ kind: 'start', weight: null })
  })

  it('peso corporal: topo sugere variação/carga extra, deload não vira carga negativa', () => {
    const up = suggestNext([session(1, 0, [12, 12, 12])], T, 'peito')
    expect(up.kind).toBe('increase')
    expect(up.reason).toMatch(/variação mais difícil/)
    const down = suggestNext([session(1, 0, [8, 7, 6]), session(2, 0, [7, 6, 6])], T, 'peito')
    expect(down).toMatchObject({ kind: 'deload', weight: 0 })
  })

  it('carga de trabalho = a mais frequente (série de aquecimento não conta)', () => {
    expect(workingWeight({ date: 0, sets: [{ weight: 40, reps: 12 }, { weight: 60, reps: 10 }, { weight: 60, reps: 9 }] })).toBe(60)
  })
})
