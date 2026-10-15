import type { ExercisePrescription, ExerciseResultV2, Range } from '../types'
import { fmtKg, roundToHalf } from './common'

/**
 * Contas de carga: 1RM estimado (Epley) e a conversão de volta para kg.
 * Só informam — quem decide a sugestão da próxima sessão continua sendo a estratégia do objetivo.
 */

/** Epley: 1RM ≈ peso × (1 + reps/30). */
export const epley = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))

/** Acima disso a estimativa perde precisão; só usamos se não houver série mais pesada. */
const MAX_REPS_ESTIMATE = 12
/** RPE assumido quando a prescrição não define um alvo. */
const DEFAULT_RPE = 8

/** Reps em reserva a partir do RPE (RPE 8 = sobravam 2). Sem RPE, conta como série até o fim. */
const rir = (rpe: number | null | undefined) => (rpe == null ? 0 : Math.max(0, 10 - rpe))
const mid = (r: Range) => (r.min + r.max) / 2

export interface Estimate {
  e1rm: number
  /** Série que gerou a estimativa. */
  weight: number
  reps: number
  rpe: number | null
}

/** Melhor estimativa de 1RM entre as séries (reps em reserva contam como reps possíveis). Null sem carga externa. */
export function estimate1rm(sets: { weight: number; reps: number; rpe?: number | null }[]): Estimate | null {
  const usable = sets.filter((s) => s.weight > 0 && s.reps > 0)
  if (!usable.length) return null
  const pool = usable.some((s) => s.reps <= MAX_REPS_ESTIMATE) ? usable.filter((s) => s.reps <= MAX_REPS_ESTIMATE) : usable
  let best: Estimate | null = null
  for (const s of pool) {
    const e1rm = Math.round(epley(s.weight, s.reps + rir(s.rpe)) * 10) / 10
    if (!best || e1rm > best.e1rm) best = { e1rm, weight: s.weight, reps: s.reps, rpe: s.rpe ?? null }
  }
  return best
}

/** Estimativa da sessão de carga mais recente (deload não conta: a carga foi reduzida de propósito). */
export function latestEstimate(history: ExerciseResultV2[]): Estimate | null {
  const last = history.filter((r) => r.weekKind === 'carga' && r.sets.length > 0).at(-1)
  return last ? estimate1rm(last.sets) : null
}

/** Carga para fazer `reps` com o RPE dado (Epley invertido). */
export function kgForReps(e1rm: number, reps: number, rpe: number | null = null): number {
  const total = reps + rir(rpe)
  return roundToHalf(total <= 1 ? e1rm : e1rm / (1 + total / 30))
}

export const kgAtPct = (e1rm: number, pct: number) => roundToHalf((e1rm * pct) / 100)
export const pctOf = (weight: number, e1rm: number) => Math.round((weight / e1rm) * 100)

/** Faixa de kg que a prescrição pede para este 1RM: por %1RM quando houver; senão por reps + RPE. */
export function targetKg(e1rm: number, p: Pick<ExercisePrescription, 'pct1rm' | 'reps' | 'rpe'>): Range | null {
  if (p.pct1rm) return { min: kgAtPct(e1rm, p.pct1rm.min), max: kgAtPct(e1rm, p.pct1rm.max) }
  if (!p.reps) return null
  const rpe = p.rpe ?? { min: DEFAULT_RPE, max: DEFAULT_RPE }
  // mais reps e menos esforço → ponta leve; menos reps e mais esforço → ponta pesada
  return { min: kgForReps(e1rm, p.reps.max, rpe.min), max: kgForReps(e1rm, p.reps.min, rpe.max) }
}

/** Uma carga de partida: meio da faixa da prescrição. */
export function startKg(e1rm: number, p: Pick<ExercisePrescription, 'pct1rm' | 'reps' | 'rpe'>): number | null {
  if (p.pct1rm) return kgAtPct(e1rm, mid(p.pct1rm))
  if (!p.reps) return null
  return kgForReps(e1rm, Math.round(mid(p.reps)), p.rpe ? mid(p.rpe) : DEFAULT_RPE)
}

const fmtRange = (r: Range, fmt: (n: number) => string) => (r.min === r.max ? fmt(r.min) : `${fmt(r.min).replace(' kg', '')}–${fmt(r.max)}`)
const fmtSet = (e: Pick<Estimate, 'weight' | 'reps' | 'rpe'>) =>
  `${fmtKg(e.weight)} × ${e.reps}${e.rpe != null ? ` (RPE ${e.rpe.toLocaleString('pt-BR')})` : ''}`

export interface Conta {
  estimate: Estimate
  target: Range | null
  /** Linhas curtas para a tela, na ordem da conta. */
  lines: string[]
}

/** A conta mostrada no treino: de onde vem o 1RM, o que a prescrição pede e onde a sugestão cai. */
export function contaFor(
  history: ExerciseResultV2[],
  p: Pick<ExercisePrescription, 'pct1rm' | 'reps' | 'rpe'>,
  suggestedKg: number | null,
): Conta | null {
  const estimate = latestEstimate(history)
  if (!estimate) return null
  const target = targetKg(estimate.e1rm, p)
  const lines = [`Melhor série da última vez: ${fmtSet(estimate)} → 1RM estimado ≈ ${fmtKg(estimate.e1rm)}.`]
  if (target) {
    lines.push(
      p.pct1rm
        ? `Alvo de hoje: ${p.pct1rm.min === p.pct1rm.max ? p.pct1rm.min : `${p.pct1rm.min}–${p.pct1rm.max}`}% do 1RM = ${fmtRange(target, fmtKg)}.`
        : `Para ${p.reps!.min === p.reps!.max ? p.reps!.min : `${p.reps!.min}–${p.reps!.max}`} reps${p.rpe ? ` em RPE ${p.rpe.min}–${p.rpe.max}` : ''}: ${fmtRange(target, fmtKg)}.`,
    )
  }
  if (suggestedKg && suggestedKg > 0) lines.push(`A sugestão (${fmtKg(suggestedKg)}) é ${pctOf(suggestedKg, estimate.e1rm)}% do 1RM estimado.`)
  return { estimate, target, lines }
}

/** Carga de referência informada pelo usuário (ex.: 40 kg × 10) → carga de partida para a prescrição. */
export function fromReference(
  ref: { weight: number; reps: number },
  p: Pick<ExercisePrescription, 'pct1rm' | 'reps' | 'rpe'>,
): { e1rm: number; kg: number; text: string } | null {
  const est = estimate1rm([ref])
  if (!est) return null
  const kg = startKg(est.e1rm, p)
  if (kg === null) return null
  const alvo = p.pct1rm
    ? `${p.pct1rm.min === p.pct1rm.max ? p.pct1rm.min : Math.round(mid(p.pct1rm))}% do 1RM`
    : `${Math.round(mid(p.reps!))} reps em RPE ${(p.rpe ? mid(p.rpe) : DEFAULT_RPE).toLocaleString('pt-BR')}`
  return { e1rm: est.e1rm, kg, text: `${fmtSet(est)} → 1RM ≈ ${fmtKg(est.e1rm)}. Para ${alvo}: ${fmtKg(kg)}.` }
}
