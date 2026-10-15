import { describe, expect, it } from 'vitest'
import type { MuscleGroup } from '../../src/data/curated'
import { GOALS } from '../../src/programacao/goals'
import { suggestNextV2 } from '../../src/programacao/progression'
import type { ExercisePrescription, ExerciseResultV2, GoalId, ProgressionContext } from '../../src/programacao/types'

const pres = (over: Partial<ExercisePrescription> = {}): ExercisePrescription => ({
  exerciseId: 'x',
  role: 'composto',
  group: 'peito',
  sets: 3,
  reps: { min: 8, max: 12 },
  restSec: 90,
  ...over,
})

const session = (weight: number, reps: number[], opts: { rpe?: number | null; p?: ExercisePrescription; deload?: boolean } = {}): ExerciseResultV2 => ({
  date: 1,
  weekKind: opts.deload ? 'deload' : 'carga',
  prescription: opts.p ?? pres({ sets: reps.length }),
  sets: reps.map((r) => ({ weight, reps: r, rpe: opts.rpe ?? null, restBeforeSec: null })),
})

const ctx = (
  goal: GoalId,
  role: ProgressionContext['role'],
  p: ExercisePrescription,
  history: ExerciseResultV2[],
  extra: Partial<ProgressionContext> = {},
): ProgressionContext => ({ goal: GOALS[goal], role, group: p.group as MuscleGroup, prescription: p, history, weekKind: 'carga', bodyweight: false, ...extra })

/** Roda as sessões em sequência e imprime o estado após cada uma. */
function run(label: string, goal: GoalId, role: ProgressionContext['role'], p: ExercisePrescription, sessions: ExerciseResultV2[]) {
  console.log(`\n=== ${label} ===`)
  const h: ExerciseResultV2[] = []
  let s = suggestNextV2(ctx(goal, role, p, h))
  sessions.forEach((r, i) => {
    h.push(r)
    s = suggestNextV2(ctx(goal, role, p, h))
    console.log(`sessão ${i + 1}: ${r.sets[0].weight} kg × ${r.sets.map((x) => x.reps).join('/')}${r.sets[0].rpe !== null ? ` @RPE ${r.sets[0].rpe}` : ''} → ${s.kind} ${s.weight ?? '—'} kg | "${s.reason}"`)
  })
  return s
}

describe('dupla_progressao (Hipertrofia) — cenários da checklist original', () => {
  const p = pres()
  it('Supino 60 kg 12/12/12 → 62,5 kg', () => {
    expect(run('Supino 12/12/12', 'hipertrofia', 'composto', p, [session(60, [12, 12, 12])])).toMatchObject({ kind: 'increase', weight: 62.5 })
  })
  it('Agachamento 80 kg 12/12/12 → 85 kg (inferiores +5)', () => {
    const q = pres({ group: 'quadriceps' })
    expect(run('Agachamento 12/12/12', 'hipertrofia', 'composto', q, [session(80, [12, 12, 12], { p: q })])).toMatchObject({ kind: 'increase', weight: 85 })
  })
  it('60 kg 10/9/8 e 9/8/7 → deload 54 kg', () => {
    expect(run('Supino 10/9/8 → 9/8/7', 'hipertrofia', 'composto', p, [session(60, [10, 9, 8]), session(60, [9, 8, 7])])).toMatchObject({ kind: 'deload', weight: 54 })
  })
  it('60 kg 12/12/11 → mantém 60 kg', () => {
    expect(run('Supino 12/12/11', 'hipertrofia', 'composto', p, [session(60, [12, 12, 11])])).toMatchObject({ kind: 'keep', weight: 60 })
  })
  it('quem progride dentro da faixa não leva deload (10/9/8 → 11/10/9)', () => {
    expect(run('progredindo', 'hipertrofia', 'composto', p, [session(60, [10, 9, 8]), session(60, [11, 10, 9])])).toMatchObject({ kind: 'keep', failStreak: 0 })
  })
})

describe('carga_por_rpe (Força)', () => {
  const p = pres({ role: 'principal', sets: 5, reps: { min: 3, max: 5 }, restSec: 240 })
  const s5 = (w: number, rpe: number | null, reps = [5, 5, 5, 5, 5]) => session(w, reps, { rpe, p })
  it('todas as reps com RPE ≤ 7 → +2,5 kg', () => {
    expect(run('Força RPE 7', 'forca', 'principal', p, [s5(100, 7)])).toMatchObject({ kind: 'increase', weight: 102.5 })
  })
  it('inferiores sobem 5 kg', () => {
    const q = { ...p, group: 'quadriceps' as const }
    expect(suggestNextV2(ctx('forca', 'principal', q, [session(140, [5, 5, 5, 5, 5], { rpe: 6, p: q })]))).toMatchObject({ kind: 'increase', weight: 145 })
  })
  it('todas as reps com RPE 8–9 → mantém', () => {
    expect(suggestNextV2(ctx('forca', 'principal', p, [s5(100, 8.5)]))).toMatchObject({ kind: 'keep', weight: 100 })
  })
  it('RPE acima de 9 → reduz 5%', () => {
    expect(suggestNextV2(ctx('forca', 'principal', p, [s5(100, 9.5)]))).toMatchObject({ kind: 'decrease', weight: 95 })
  })
  it('reps abaixo do mínimo → reduz 5%', () => {
    expect(suggestNextV2(ctx('forca', 'principal', p, [s5(100, null, [5, 4, 3, 2, 2])]))).toMatchObject({ kind: 'decrease', weight: 95 })
  })
  it('dentro da faixa sem bater o topo → mantém', () => {
    expect(suggestNextV2(ctx('forca', 'principal', p, [s5(100, 8, [5, 5, 4, 4, 3])]))).toMatchObject({ kind: 'keep', weight: 100 })
  })
  it('sem RPE informado e topo batido → sobe (fallback por reps)', () => {
    expect(suggestNextV2(ctx('forca', 'principal', p, [s5(100, null)]))).toMatchObject({ kind: 'increase', weight: 102.5 })
  })
  it('progressão por carga, não por reps: a faixa de reps nunca muda', () => {
    const s = suggestNextV2(ctx('forca', 'principal', p, [s5(100, 6)]))
    expect(s.reps).toBeUndefined()
  })
})

describe('densidade (Gasto energético)', () => {
  const base = pres({ sets: 4, reps: { min: 10, max: 15 }, restSec: 75 })
  it('sequência: menos descanso até o piso → +1 série → carga (e volta ao base)', () => {
    const steps: string[] = []
    let cur = base
    for (let i = 0; i < 5; i++) {
      const s = suggestNextV2(ctx('gasto_energetico', 'composto', base, [session(40, Array(cur.sets).fill(15), { p: cur })]))
      steps.push(`${s.kind}:${s.restSec}s/${s.sets}x@${s.weight}`)
      if (s.kind === 'increase') break
      cur = { ...cur, restSec: s.restSec!, sets: s.sets! }
    }
    console.log('densidade:', steps.join(' → '))
    expect(steps).toEqual(['less_rest:60s/4x@40', 'less_rest:45s/4x@40', 'add_set:45s/5x@40', 'increase:75s/4x@42.5'])
  })
  it('sem bater o topo mantém tudo', () => {
    expect(suggestNextV2(ctx('gasto_energetico', 'composto', base, [session(40, [15, 13, 12, 12], { p: base })]))).toMatchObject({ kind: 'keep', restSec: 75, sets: 4 })
  })
})

describe('reps_depois_carga (Resistência)', () => {
  const p = pres({ sets: 3, reps: { min: 15, max: 25 }, restSec: 45 })
  it('soma reps até 25; aí sobe carga e volta a 15', () => {
    expect(suggestNextV2(ctx('resistencia', 'composto', p, [session(20, [17, 16, 15], { p })]))).toMatchObject({ kind: 'more_reps', weight: 20, reps: { min: 17, max: 25 } })
    expect(suggestNextV2(ctx('resistencia', 'composto', p, [session(20, [25, 25, 25], { p })]))).toMatchObject({ kind: 'increase', weight: 22.5, reps: { min: 15, max: 25 } })
  })
})

describe('regras comuns', () => {
  it('semana de deload: séries e carga reduzidas, RPE limitado', () => {
    const p = pres({ role: 'principal', sets: 3, reps: { min: 3, max: 5 } })
    const s = suggestNextV2(ctx('forca', 'principal', p, [session(100, [5, 5, 5], { p })], { weekKind: 'deload' }))
    expect(s).toMatchObject({ kind: 'deload', weight: 85 })
    expect(s.reason).toMatch(/RPE até 6/)
  })
  it('sessões de deload não contam como falha na dupla progressão', () => {
    const p = pres()
    const h = [session(60, [10, 9, 8]), session(54, [8, 8, 8], { deload: true }), session(60, [10, 9, 8])]
    expect(suggestNextV2(ctx('hipertrofia', 'composto', p, h)).kind).not.toBe('deload')
  })
  it('sem histórico pede carga inicial com a faixa e o RPE alvo', () => {
    const s = suggestNextV2(ctx('forca', 'principal', pres({ reps: { min: 3, max: 5 }, rpe: { min: 7, max: 9 } }), []))
    expect(s).toMatchObject({ kind: 'start', weight: null })
    expect(s.reason).toContain('RPE 7–9')
  })
  it('peso corporal nunca sugere kg', () => {
    const s = suggestNextV2(ctx('hipertrofia', 'composto', pres(), [session(0, [12, 12, 12])], { bodyweight: true }))
    expect(s.weight).toBe(0)
    expect(s.reason).toMatch(/lastro|variação mais difícil/)
  })
})
