import type { GoalProfile } from '../types'

export const HIPERTROFIA = {
  id: 'hipertrofia',
  nome: 'Hipertrofia',
  resumo: 'Ganhar massa muscular com volume moderado a alto, perto da falha, misturando compostos e isoladores.',

  roles: {
    principal: { sets: { min: 3, max: 4 }, reps: { min: 6, max: 10 }, restSec: { min: 105, max: 120 }, intensity: { pct1rm: { min: 70, max: 80 }, rpe: { min: 7, max: 9 } } },
    composto: { sets: { min: 3, max: 4 }, reps: { min: 8, max: 12 }, restSec: { min: 90, max: 120 }, intensity: { pct1rm: { min: 65, max: 77 }, rpe: { min: 7, max: 9 } } },
    isolador: { sets: { min: 3, max: 3 }, reps: { min: 8, max: 12 }, restSec: { min: 90, max: 90 }, intensity: { rpe: { min: 8, max: 9 } } },
  },
  levelOverrides: {
    iniciante: {
      principal: { sets: { min: 3, max: 3 }, reps: { min: 8, max: 12 }, intensity: { pct1rm: { min: 65, max: 75 }, rpe: { min: 6, max: 8 } } },
      composto: { sets: { min: 3, max: 3 }, intensity: { rpe: { min: 6, max: 8 } } },
    },
  },

  compoundShare: { range: { min: 40, max: 70 }, base: 'compostos' },
  weeklySets: {
    peito: { min: 10, max: 20 },
    costas: { min: 10, max: 20 },
    quadriceps: { min: 10, max: 20 },
    posteriores: { min: 10, max: 20 },
    ombros: { min: 10, max: 20 },
  },

  dayStructure: [
    { kind: 'simples', roles: ['principal'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['isolador'] },
    { kind: 'simples', roles: ['isolador'] },
    { kind: 'simples', roles: ['isolador'], optional: true },
  ],

  progression: {
    principal: { rule: 'dupla_progressao', increment: { superiorKg: 2.5, inferiorKg: 5 }, falhasParaDeload: 2, deloadPct: 10 },
    composto: { rule: 'dupla_progressao', increment: { superiorKg: 2.5, inferiorKg: 5 }, falhasParaDeload: 2, deloadPct: 10 },
    isolador: { rule: 'dupla_progressao', increment: { superiorKg: 1, inferiorKg: 2.5 }, falhasParaDeload: 2, deloadPct: 10 },
  },
  periodization: { kind: 'reativo', deloadPlanejadoACadaSemanas: 6, deload: { fatorSeries: 0.6, fatorCarga: 0.9, rpeMax: 6 } },

  warnings: [
    {
      id: 'hipertrofia_peso_corporal',
      when: { equipment: ['peso_corporal'] },
      severity: 'info',
      text: 'Sem carga externa, a progressão vem de mais repetições, pausas e variações mais difíceis; perto da falha, o estímulo para crescer continua bom.',
    },
  ],

  explanation: {
    template:
      'Cada grupo grande recebe {volumeResumo} séries por semana, entre compostos ({seriesPrincipal}x{repsPrincipal}, {descansoPrincipal} de descanso) e isoladores ({repsAcessorio} reps, {descansoAcessorio}). ' +
      'As séries vão até RPE 7–9, perto da falha, que é onde o estímulo para crescer está. {progressao} {periodizacao}',
    expectativa4a8Semanas:
      'Em 4–8 semanas, espere subir carga ou repetições na maioria dos exercícios. Ganho de massa visível costuma levar mais tempo e depende de dormir bem e comer proteína suficiente.',
  },
} satisfies GoalProfile
