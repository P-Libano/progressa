import { LOWER_BODY_GROUPS } from '../../data/curated'
import type { ExerciseResultV2, LoadIncrement, ProgressionContext, SuggestionV2 } from '../types'

export const roundToHalf = (kg: number) => Math.round(kg * 2) / 2
export const fmtKg = (kg: number) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
export const fmtReps = (r: ExerciseResultV2) => r.sets.map((s) => s.reps).join('/')
export const incrementFor = (inc: LoadIncrement, group: ProgressionContext['group']) =>
  LOWER_BODY_GROUPS.has(group) ? inc.inferiorKg : inc.superiorKg

/** Carga de trabalho: a mais frequente (empate → maior). */
export function workingWeight(r: ExerciseResultV2): number {
  const count = new Map<number, number>()
  for (const s of r.sets) count.set(s.weight, (count.get(s.weight) ?? 0) + 1)
  let best = 0
  let n = -1
  for (const [w, c] of count) if (c > n || (c === n && w > best)) [best, n] = [w, c]
  return best
}

export const totalReps = (r: ExerciseResultV2) => r.sets.reduce((a, s) => a + s.reps, 0)

/** Fez todas as séries prescritas naquela sessão com reps ≥ `reps`. Sem faixa (condicionamento) = só conta séries. */
export function allSetsAtLeast(r: ExerciseResultV2, reps: number | undefined): boolean {
  const planned = r.prescription.sets
  return r.sets.length >= planned && (reps === undefined || r.sets.slice(0, planned).every((s) => s.reps >= reps))
}

/** Maior RPE informado na sessão (null se nenhum). */
export function maxRpe(r: ExerciseResultV2): number | null {
  const v = r.sets.map((s) => s.rpe).filter((x): x is number => x !== null)
  return v.length ? Math.max(...v) : null
}

/** Só sessões de carga contam para decidir progressão. */
export const loadHistory = (h: ExerciseResultV2[]) => h.filter((r) => r.weekKind === 'carga' && r.sets.length > 0)

export function start(ctx: ProgressionContext): SuggestionV2 {
  const r = ctx.prescription.reps
  return {
    kind: 'start',
    weight: null,
    failStreak: 0,
    reason: r ? `Escolha uma carga que permita ${r.min === r.max ? r.min : `${r.min}–${r.max}`} reps${ctx.prescription.rpe ? ` em RPE ${ctx.prescription.rpe.min}–${ctx.prescription.rpe.max}` : ''}.` : 'Faça no ritmo indicado.',
  }
}

/** Sem carga externa: "suba X kg" vira lastro/variação; reduzir vira variação mais fácil. */
export function bodyweightWording(s: SuggestionV2, bodyweight: boolean): SuggestionV2 {
  if (!bodyweight) return s
  if (s.kind === 'increase') return { ...s, weight: 0, reason: `${s.reason.split('.')[0]}. Sem carga externa: adicione lastro (mochila ou colete) ou passe para uma variação mais difícil.` }
  if (s.kind === 'decrease' || s.kind === 'deload') return { ...s, weight: 0, reason: `${s.reason.split('.')[0]}. Use uma variação mais fácil por uma sessão e volte a buscar a faixa.` }
  return { ...s, weight: s.weight === null ? null : 0 }
}
