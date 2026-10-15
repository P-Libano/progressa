import type { ProgressionContext, ProgressionSpec, SuggestionV2 } from '../types'
import { bodyweightWording, fmtKg, loadHistory, roundToHalf, start, workingWeight } from './common'
import { cargaPorRpe, densidade, duplaProgressao, repsDepoisCarga } from './strategies'

export * from './strategies'

const FALLBACK: ProgressionSpec = { rule: 'dupla_progressao', increment: { superiorKg: 2.5, inferiorKg: 5 }, falhasParaDeload: 2, deloadPct: 10 }

/** Estratégia de progressão do papel no objetivo. */
export function specFor(ctx: Pick<ProgressionContext, 'goal' | 'role'>): ProgressionSpec {
  return ctx.goal.progression[ctx.role] ?? FALLBACK
}

/** Ponto único: semana de deload → prescrição de deload; senão, a estratégia do objetivo/papel. */
export function suggestNextV2(ctx: ProgressionContext): SuggestionV2 {
  const loads = loadHistory(ctx.history)
  if (ctx.weekKind === 'deload') {
    const dl = ctx.goal.periodization.deload
    const last = loads.at(-1)
    const w = last ? roundToHalf(workingWeight(last) * dl.fatorCarga) : null
    return bodyweightWording(
      {
        kind: 'deload',
        weight: w,
        sets: ctx.prescription.sets,
        failStreak: 0,
        reason: `Semana de deload planejada: ${ctx.prescription.sets} séries${w !== null ? `, ${fmtKg(w)}` : ''}, RPE até ${dl.rpeMax}. Recuperar também é treino.`,
      },
      ctx.bodyweight,
    )
  }
  if (!loads.length) return start(ctx)
  const spec = specFor(ctx)
  const s =
    spec.rule === 'carga_por_rpe'
      ? cargaPorRpe(ctx, spec)
      : spec.rule === 'densidade'
        ? densidade(ctx, spec)
        : spec.rule === 'reps_depois_carga'
          ? repsDepoisCarga(ctx, spec)
          : duplaProgressao(ctx, spec)
  return bodyweightWording(s, ctx.bodyweight)
}
