import { LOWER_BODY_GROUPS, type MuscleGroup } from '../data/curated'

/**
 * Progressão dupla (double progression).
 *
 * - Topo: todas as séries planejadas com reps ≥ topo da faixa → sobe a carga
 *   (+2,5 kg superiores, +5 kg inferiores).
 * - Falha: não bateu o topo E não superou o total de reps da sessão anterior
 *   feita com a mesma carga (a 1ª sessão numa carga nova não tem com o que
 *   comparar, então conta como falha se não bater o topo).
 * - 2 falhas seguidas → deload de 10% (arredondado a 0,5 kg).
 * - Fora isso, mantém a carga e busca mais repetições.
 */

export const INCREMENT_UPPER = 2.5
export const INCREMENT_LOWER = 5
export const DELOAD_FACTOR = 0.9
export const FAILS_TO_DELOAD = 2

export interface Target {
  sets: number
  repMin: number
  repMax: number
}

/** Uma sessão passada do exercício: séries efetivamente feitas. */
export interface ExerciseResult {
  date: number
  sets: { weight: number; reps: number }[]
}

export type SuggestionKind = 'start' | 'increase' | 'keep' | 'deload'

export interface Suggestion {
  kind: SuggestionKind
  /** Carga sugerida para a próxima sessão; null = sem histórico. */
  weight: number | null
  /** Falhas seguidas acumuladas na carga atual. */
  failStreak: number
  /** Explicação curta, em pt-BR, para a tela de sessão. */
  reason: string
}

export const roundToHalf = (kg: number) => Math.round(kg * 2) / 2
export const incrementFor = (group: MuscleGroup) => (LOWER_BODY_GROUPS.has(group) ? INCREMENT_LOWER : INCREMENT_UPPER)

/** Carga de trabalho da sessão: a mais frequente entre as séries (empate → maior). */
export function workingWeight(r: ExerciseResult): number {
  const count = new Map<number, number>()
  for (const s of r.sets) count.set(s.weight, (count.get(s.weight) ?? 0) + 1)
  let best = 0
  let bestN = -1
  for (const [w, n] of count) if (n > bestN || (n === bestN && w > best)) [best, bestN] = [w, n]
  return best
}

export const totalReps = (r: ExerciseResult) => r.sets.reduce((a, s) => a + s.reps, 0)

/** Bateu o topo em todas as séries planejadas (série faltando conta como não batida). */
export function hitTop(r: ExerciseResult, t: Target): boolean {
  return r.sets.length >= t.sets && r.sets.slice(0, t.sets).every((s) => s.reps >= t.repMax)
}

export const fmtKg = (kg: number) => `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`
export const fmtReps = (r: ExerciseResult) => r.sets.map((s) => s.reps).join('/')

/** Avalia o histórico (ordem cronológica) e sugere a carga da próxima sessão. */
export function suggestNext(history: ExerciseResult[], t: Target, group: MuscleGroup): Suggestion {
  const results = history.filter((h) => h.sets.length > 0)
  if (!results.length) {
    return { kind: 'start', weight: null, failStreak: 0, reason: `Escolha uma carga que permita ${t.repMin}–${t.repMax} reps.` }
  }
  const inc = incrementFor(group)
  let suggestion: Suggestion = { kind: 'keep', weight: null, failStreak: 0, reason: '' }
  let streak = 0
  let prev: ExerciseResult | undefined

  for (const r of results) {
    const w = workingWeight(r)
    const prevSameWeight = prev && workingWeight(prev) === w ? prev : undefined
    if (prev && workingWeight(prev) !== w) streak = 0 // carga mudou: nova contagem

    if (hitTop(r, t)) {
      streak = 0
      suggestion = {
        kind: 'increase',
        weight: roundToHalf(w + inc),
        failStreak: 0,
        reason: `Você fez ${fmtReps(r)} — topo da faixa em todas as séries. Suba ${fmtKg(inc)}.`,
      }
    } else if (prevSameWeight && totalReps(r) > totalReps(prevSameWeight)) {
      streak = 0
      suggestion = {
        kind: 'keep',
        weight: w,
        failStreak: 0,
        reason: `Progrediu (${fmtReps(prevSameWeight)} → ${fmtReps(r)}). Mantenha ${fmtKg(w)} e busque ${t.repMax} reps.`,
      }
    } else {
      streak++
      if (streak >= FAILS_TO_DELOAD) {
        const d = roundToHalf(w * DELOAD_FACTOR)
        suggestion = {
          kind: 'deload',
          weight: d,
          failStreak: streak,
          reason: `${streak} sessões seguidas sem progresso (última: ${fmtReps(r)}). Deload de 10%: ${fmtKg(w)} → ${fmtKg(d)}.`,
        }
        streak = 0
      } else {
        suggestion = {
          kind: 'keep',
          weight: w,
          failStreak: streak,
          reason: `Última: ${fmtReps(r)}. Mantenha ${fmtKg(w)} e busque ${t.repMax} reps em todas as séries.`,
        }
      }
    }
    prev = r
  }
  return bodyweightWording(suggestion, workingWeight(results[results.length - 1]), t)
}

/** Sem carga externa (peso corporal), "suba X kg" e "deload 10%" viram orientação de variação. */
function bodyweightWording(s: Suggestion, lastWeight: number, t: Target): Suggestion {
  if (lastWeight > 0) return s
  if (s.kind === 'increase') {
    return { ...s, reason: `Topo da faixa em todas as séries. Adicione carga (mochila/colete, ~${fmtKg(s.weight!)}) ou use uma variação mais difícil.` }
  }
  if (s.kind === 'deload') {
    return { ...s, weight: 0, reason: `${s.failStreak} sessões sem progresso. Use uma variação mais fácil por uma semana e volte a buscar ${t.repMin}–${t.repMax} reps.` }
  }
  return s
}
