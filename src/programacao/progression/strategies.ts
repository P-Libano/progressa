import type { ExerciseResultV2, ProgressionContext, ProgressionSpec, SuggestionV2 } from '../types'
import { allSetsAtLeast, fmtKg, fmtReps, incrementFor, loadHistory, maxRpe, roundToHalf, totalReps, workingWeight } from './common'

type Spec<R extends ProgressionSpec['rule']> = Extract<ProgressionSpec, { rule: R }>

/**
 * Força: progressão por carga guiada por RPE.
 * Todas as reps no topo e RPE ≤ subirSeRpeAte (ou sem RPE) → sobe; RPE até manterSeRpeAte → mantém;
 * acima disso ou reps abaixo do mínimo → reduz `reducaoPct`.
 */
export function cargaPorRpe(ctx: ProgressionContext, p: Spec<'carga_por_rpe'>): SuggestionV2 {
  const last = loadHistory(ctx.history).at(-1)!
  const w = workingWeight(last)
  const reps = ctx.prescription.reps
  const rpe = maxRpe(last)
  const inc = incrementFor(p.increment, ctx.group)
  const rpeTxt = rpe === null ? 'sem RPE informado' : `RPE ${rpe.toLocaleString('pt-BR')}`
  const reduce = (why: string): SuggestionV2 => {
    const nw = roundToHalf(w * (1 - p.reducaoPct / 100))
    return { kind: 'decrease', weight: nw, failStreak: 1, reason: `${why} Reduza ${p.reducaoPct}%: ${fmtKg(w)} → ${fmtKg(nw)}.` }
  }
  if (rpe !== null && rpe > p.manterSeRpeAte) return reduce(`${fmtReps(last)} com ${rpeTxt}: esforço acima do alvo.`)
  if (allSetsAtLeast(last, reps?.max)) {
    if (rpe === null || rpe <= p.subirSeRpeAte) {
      return {
        kind: 'increase',
        weight: roundToHalf(w + inc),
        failStreak: 0,
        reason: `${fmtReps(last)} com ${rpeTxt}: todas as reps com folga. Suba ${fmtKg(inc)} → ${fmtKg(roundToHalf(w + inc))}.`,
      }
    }
    return { kind: 'keep', weight: w, failStreak: 0, reason: `${fmtReps(last)} com ${rpeTxt}: completo, mas pesado. Mantenha ${fmtKg(w)} até o RPE cair para ${p.subirSeRpeAte}.` }
  }
  if (allSetsAtLeast(last, reps?.min)) {
    return { kind: 'keep', weight: w, failStreak: 0, reason: `${fmtReps(last)}: dentro da faixa. Mantenha ${fmtKg(w)} e busque ${reps?.max} reps em todas as séries.` }
  }
  return reduce(`${fmtReps(last)}: abaixo do mínimo de ${reps?.min} reps.`)
}

/** Hipertrofia: dupla progressão (reps até o topo, depois carga; deload após N sessões sem progresso). */
export function duplaProgressao(ctx: ProgressionContext, p: Spec<'dupla_progressao'>): SuggestionV2 {
  const reps = ctx.prescription.reps
  const inc = incrementFor(p.increment, ctx.group)
  let s: SuggestionV2 = { kind: 'keep', weight: null, failStreak: 0, reason: '' }
  let streak = 0
  let prev: ExerciseResultV2 | undefined
  for (const r of ctx.history.filter((x) => x.sets.length > 0)) {
    if (r.weekKind === 'deload') {
      // semana de deload planejada recomeça a contagem de falhas
      streak = 0
      prev = undefined
      continue
    }
    const w = workingWeight(r)
    const prevSame = prev && workingWeight(prev) === w ? prev : undefined
    if (prev && workingWeight(prev) !== w) streak = 0
    if (allSetsAtLeast(r, reps?.max)) {
      streak = 0
      s = { kind: 'increase', weight: roundToHalf(w + inc), failStreak: 0, reason: `Você fez ${fmtReps(r)} — topo da faixa em todas as séries. Suba ${fmtKg(inc)}.` }
    } else if (prevSame && totalReps(r) > totalReps(prevSame)) {
      streak = 0
      s = { kind: 'keep', weight: w, failStreak: 0, reason: `Progrediu (${fmtReps(prevSame)} → ${fmtReps(r)}). Mantenha ${fmtKg(w)} e busque ${reps?.max} reps.` }
    } else {
      streak++
      if (streak >= p.falhasParaDeload) {
        const d = roundToHalf(w * (1 - p.deloadPct / 100))
        s = { kind: 'deload', weight: d, failStreak: streak, reason: `${streak} sessões seguidas sem progresso (última: ${fmtReps(r)}). Deload de ${p.deloadPct}%: ${fmtKg(w)} → ${fmtKg(d)}.` }
        streak = 0
      } else {
        s = { kind: 'keep', weight: w, failStreak: streak, reason: `Última: ${fmtReps(r)}. Mantenha ${fmtKg(w)} e busque ${reps?.max} reps em todas as séries.` }
      }
    }
    prev = r
  }
  return s
}

/**
 * Gasto energético: densidade. Ao bater o topo: 1º reduz descanso; 2º +1 série; 3º sobe carga
 * e volta descanso/séries ao base do programa. Sem bater o topo: mantém tudo.
 */
export function densidade(ctx: ProgressionContext, p: Spec<'densidade'>): SuggestionV2 {
  const last = loadHistory(ctx.history).at(-1)!
  const w = workingWeight(last)
  const base = ctx.prescription
  const cur = last.prescription
  const inc = incrementFor(p.increment, ctx.group)
  if (!allSetsAtLeast(last, base.reps?.max)) {
    return {
      kind: 'keep',
      weight: w,
      restSec: cur.restSec,
      sets: cur.sets,
      failStreak: 1,
      reason: `${fmtReps(last)}: ainda abaixo do topo. Mantenha ${fmtKg(w)}, ${cur.sets} séries e ${cur.restSec}s de descanso.`,
    }
  }
  if (cur.restSec > p.descansoPisoSec) {
    const rest = Math.max(p.descansoPisoSec, cur.restSec - p.reduzirDescansoSec)
    return { kind: 'less_rest', weight: w, restSec: rest, sets: cur.sets, failStreak: 0, reason: `Topo em todas as séries. Mesmo peso, menos descanso: ${cur.restSec}s → ${rest}s.` }
  }
  if (cur.sets < base.sets + p.seriesExtrasMax) {
    return { kind: 'add_set', weight: w, restSec: cur.restSec, sets: cur.sets + 1, failStreak: 0, reason: `Topo com descanso mínimo. Acrescente uma série: ${cur.sets} → ${cur.sets + 1}.` }
  }
  return {
    kind: 'increase',
    weight: roundToHalf(w + inc),
    restSec: base.restSec,
    sets: base.sets,
    failStreak: 0,
    reason: `Densidade máxima atingida. Suba ${fmtKg(inc)} e volte para ${base.sets} séries com ${base.restSec}s de descanso.`,
  }
}

/** Resistência: soma reps até o topo; aí sobe carga e volta ao início da faixa. */
export function repsDepoisCarga(ctx: ProgressionContext, p: Spec<'reps_depois_carga'>): SuggestionV2 {
  const last = loadHistory(ctx.history).at(-1)!
  const w = workingWeight(last)
  const reps = ctx.prescription.reps ?? { min: 15, max: 25 }
  const inc = incrementFor(p.increment, ctx.group)
  const achieved = last.sets.length >= last.prescription.sets ? Math.min(...last.sets.map((s) => s.reps)) : 0
  if (achieved >= reps.max) {
    return { kind: 'increase', weight: roundToHalf(w + inc), reps: { ...reps }, failStreak: 0, reason: `${fmtReps(last)}: chegou a ${reps.max} reps. Suba ${fmtKg(inc)} e volte para ${reps.min} reps.` }
  }
  const target = Math.min(reps.max, Math.max(reps.min, achieved + p.repsPorPasso))
  return {
    kind: 'more_reps',
    weight: w,
    reps: { min: target, max: reps.max },
    failStreak: 0,
    reason: `${fmtReps(last)}. Mesma carga, busque ${target} reps em todas as séries.`,
  }
}
