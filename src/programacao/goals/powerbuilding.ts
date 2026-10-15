import type { GoalProfile } from '../types'

export const POWERBUILDING = {
  id: 'powerbuilding',
  nome: 'Força + hipertrofia',
  resumo: 'Um básico pesado no começo de cada treino e o resto em faixa de hipertrofia.',

  roles: {
    principal: { sets: { min: 4, max: 4 }, reps: { min: 3, max: 5 }, restSec: { min: 180, max: 240 }, intensity: { pct1rm: { min: 80, max: 87 }, rpe: { min: 7, max: 9 } } },
    composto: { sets: { min: 3, max: 4 }, reps: { min: 6, max: 10 }, restSec: { min: 90, max: 120 }, intensity: { pct1rm: { min: 67, max: 77 }, rpe: { min: 7, max: 9 } } },
    isolador: { sets: { min: 3, max: 3 }, reps: { min: 10, max: 15 }, restSec: { min: 60, max: 75 }, intensity: { rpe: { min: 8, max: 9 } } },
  },
  levelOverrides: {
    iniciante: {
      principal: { sets: { min: 4, max: 4 }, reps: { min: 5, max: 5 }, intensity: { pct1rm: { min: 72, max: 80 }, rpe: { min: 6, max: 8 } } },
    },
  },

  compoundShare: { range: { min: 50, max: 80 }, base: 'compostos' },
  weeklySets: {
    peito: { min: 8, max: 18 },
    costas: { min: 10, max: 18 },
    quadriceps: { min: 8, max: 18 },
    posteriores: { min: 8, max: 16 },
    ombros: { min: 8, max: 16 },
  },

  dayStructure: [
    { kind: 'simples', roles: ['principal'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['isolador'] },
    { kind: 'simples', roles: ['isolador'], optional: true },
  ],

  progression: {
    principal: { rule: 'carga_por_rpe', increment: { superiorKg: 2.5, inferiorKg: 5 }, subirSeRpeAte: 7, manterSeRpeAte: 9, reducaoPct: 5 },
    composto: { rule: 'dupla_progressao', increment: { superiorKg: 2.5, inferiorKg: 5 }, falhasParaDeload: 2, deloadPct: 10 },
    isolador: { rule: 'dupla_progressao', increment: { superiorKg: 1, inferiorKg: 2.5 }, falhasParaDeload: 2, deloadPct: 10 },
  },
  periodization: { kind: 'bloco', semanasCarga: 3, semanasDeload: 1, rampaPct1rm: [80, 83.5, 87], deload: { fatorSeries: 0.6, fatorCarga: 0.85, rpeMax: 6 } },

  warnings: [
    {
      id: 'pb_peso_corporal',
      when: { equipment: ['peso_corporal'] },
      severity: 'aviso',
      text: 'Sem carga externa, o exercício pesado do dia vira uma variação difícil com lastro (mochila ou colete); a parte de força fica limitada.',
    },
  ],

  explanation: {
    template:
      'O primeiro exercício do dia ({principais}) é pesado: {seriesPrincipal}x{repsPrincipal} a {intensidadePrincipal}, {descansoPrincipal} de descanso. ' +
      'O resto do treino fica em faixa de hipertrofia ({repsAcessorio} reps nos isoladores, {descansoAcessorio}). {progressao} {periodizacao}',
    expectativa4a8Semanas: 'Em 4–8 semanas, espere ganhar carga nos básicos e volume nos demais exercícios; força cresce mais rápido do que tamanho.',
  },
} satisfies GoalProfile
