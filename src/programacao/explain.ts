import { LOWER_BODY_GROUPS } from '../data/curated'
import { SPLIT_PT } from '../domain/profile'
import { findUnfoundedClaims } from '../lib/claims'
import type { ExercisePrescription, GoalProfile, Program, ProgressionSpec, Range } from './types'
import { LARGE_GROUPS } from './templates'

const fmtRange = (r: Range | undefined, unit = '') => (!r ? '—' : r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`)
export const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`)
const kg = (n: number) => `${n.toLocaleString('pt-BR')} kg`

export function progressionText(p: ProgressionSpec | undefined): string {
  if (!p) return ''
  switch (p.rule) {
    case 'carga_por_rpe':
      return `A carga sobe ${kg(p.increment.superiorKg)} (superiores) ou ${kg(p.increment.inferiorKg)} (inferiores) quando você completa todas as repetições com RPE até ${p.subirSeRpeAte}; acima de RPE ${p.manterSeRpeAte}, ela cai ${p.reducaoPct}%.`
    case 'dupla_progressao':
      return `Progressão dupla: quando todas as séries chegam ao topo da faixa, a carga sobe; ${p.falhasParaDeload} sessões seguidas sem progresso geram um deload de ${p.deloadPct}%.`
    case 'densidade':
      return `A progressão é por densidade: primeiro o descanso cai ${p.reduzirDescansoSec}s por vez até ${p.descansoPisoSec}s, depois entra ${p.seriesExtrasMax === 1 ? 'uma série a mais' : `até ${p.seriesExtrasMax} séries a mais`}, e só então a carga sobe.`
    case 'reps_depois_carga':
      return `Você soma ${p.repsPorPasso} repetições por sessão até o topo da faixa; aí a carga sobe e as repetições voltam ao início.`
  }
}

function periodizationText(g: GoalProfile, program: Program): string {
  const p = g.periodization
  if (p.kind === 'bloco') {
    // percentuais reais do principal em cada semana de carga (já ajustados ao nível)
    const ramp = program.blocks[0].weeks
      .filter((w) => w.kind === 'carga')
      .map((w) => w.days.flatMap((d) => d.groups.flatMap((x) => x.items)).find((i) => i.role === 'principal')?.pct1rm?.min)
      .filter((x): x is number => x !== undefined)
    const rampTxt = ramp.length ? ` (${ramp.map((x) => `${x.toLocaleString('pt-BR')}%`).join(' → ')} de 1RM no principal)` : ''
    return `O bloco tem ${p.semanasCarga} semanas subindo a intensidade${rampTxt} e ${p.semanasDeload} de deload, com menos séries e carga mais leve.`
  }
  return `A cada ${p.deloadPlanejadoACadaSemanas} semanas há uma semana de deload; antes disso, se a progressão travar, o app reduz a carga.`
}

/** Texto "por que este treino" a partir do programa gerado. */
export function explain(program: Program, nameOf: (id: string) => string): string {
  const g = program.goal
  const week = program.blocks[0].weeks.find((w) => w.kind === 'carga') ?? program.blocks[0].weeks[0]
  const items = week.days.flatMap((d) => d.groups.flatMap((x) => x.items))
  const first = (role: ExercisePrescription['role']) => items.find((i) => i.role === role)
  const main = first('principal') ?? first('composto')
  const acc = first('isolador') ?? first('composto')
  const principals = [...new Set(items.filter((i) => i.role === 'principal').map((i) => nameOf(i.exerciseId).toLowerCase()))]
  const largeVol = LARGE_GROUPS.map((x) => program.weeklyVolume[x] ?? 0).filter((n) => n > 0)
  const finishers = week.days.filter((d) => d.groups.some((x) => x.kind === 'finisher')).length
  const intensity = main
    ? [main.pct1rm && `${fmtRange(main.pct1rm, '%')} de 1RM`, main.rpe && `RPE ${fmtRange(main.rpe)}`].filter(Boolean).join(' (') + (main.pct1rm && main.rpe ? ')' : '')
    : '—'
  const mainRole = main?.role ?? 'composto'
  const vars: Record<string, string> = {
    principais: principals.join(', ') || 'compostos',
    seriesPrincipal: String(main?.sets ?? '—'),
    repsPrincipal: fmtRange(main?.reps),
    descansoPrincipal: main ? fmtRest(main.restSec) : '—',
    intensidadePrincipal: intensity,
    repsAcessorio: fmtRange(acc?.reps),
    descansoAcessorio: acc ? fmtRest(acc.restSec) : '—',
    progressao: progressionText(g.progression[mainRole]),
    periodizacao: periodizationText(g, program),
    finisherPorSemana: finishers ? `${finishers}x por semana` : '',
    volumeResumo: largeVol.length ? `${Math.min(...largeVol)} a ${Math.max(...largeVol)}` : '—',
    dias: String(program.profile.daysPerWeek),
    split: SPLIT_PT[program.profile.split],
  }
  const body = g.explanation.template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '')
  const text = `${body} ${g.explanation.expectativa4a8Semanas}`.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim()
  const bad = findUnfoundedClaims(text)
  if (bad.length) throw new Error(`Texto do objetivo ${g.id} com promessa sem base: ${bad.join(', ')}`)
  return text
}

/** Membro inferior? (incremento de carga maior). */
export const isLower = (group: ExercisePrescription['group']) => LOWER_BODY_GROUPS.has(group)
