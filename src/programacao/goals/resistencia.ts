import type { GoalProfile } from '../types'

export const RESISTENCIA = {
  id: 'resistencia',
  nome: 'Resistência muscular',
  resumo: 'Aguentar mais repetições com cargas leves e descansos curtos.',

  roles: {
    composto: { sets: { min: 2, max: 3 }, reps: { min: 15, max: 25 }, restSec: { min: 45, max: 60 }, intensity: { pct1rm: { min: 40, max: 60 }, rpe: { min: 6, max: 8 } } },
    isolador: { sets: { min: 2, max: 3 }, reps: { min: 15, max: 25 }, restSec: { min: 30, max: 45 }, intensity: { rpe: { min: 6, max: 8 } } },
  },
  levelOverrides: {
    iniciante: { composto: { sets: { min: 2, max: 2 } }, isolador: { sets: { min: 2, max: 2 } } },
  },

  compoundShare: { range: { min: 40, max: 80 }, base: 'compostos' },
  weeklySets: {
    peito: { min: 4, max: 12 },
    costas: { min: 4, max: 12 },
    quadriceps: { min: 4, max: 12 },
    posteriores: { min: 4, max: 12 },
    ombros: { min: 4, max: 12 },
  },

  dayStructure: [
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['isolador'] },
    { kind: 'simples', roles: ['isolador'], optional: true },
  ],

  progression: {
    composto: { rule: 'reps_depois_carga', repsPorPasso: 2, increment: { superiorKg: 2.5, inferiorKg: 5 } },
    isolador: { rule: 'reps_depois_carga', repsPorPasso: 2, increment: { superiorKg: 1, inferiorKg: 2.5 } },
  },
  periodization: { kind: 'reativo', deloadPlanejadoACadaSemanas: 6, deload: { fatorSeries: 0.6, fatorCarga: 0.9, rpeMax: 6 } },

  warnings: [],

  explanation: {
    template:
      'Cargas leves ({seriesPrincipal}x{repsPrincipal}) com {descansoPrincipal} de descanso nos compostos e {descansoAcessorio} nos isoladores treinam o músculo a sustentar esforço por mais tempo. {progressao} {periodizacao}',
    expectativa4a8Semanas: 'Em 4–8 semanas, espere completar mais repetições com a mesma carga e se recuperar mais rápido entre as séries.',
  },
} satisfies GoalProfile
