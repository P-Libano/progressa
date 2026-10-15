import type { GoalProfile } from '../types'

/** Gasto energético / recomposição corporal — RASCUNHO para aprovação (etapa A). */
export const GASTO_ENERGETICO = {
  id: 'gasto_energetico',
  nome: 'Gasto energético (recomposição)',
  resumo:
    'Ganhar ou manter massa magra com treinos densos: muito trabalho em pouco tempo, descansos curtos e um bloco de condicionamento. ' +
    'O gasto calórico vem principalmente do próprio treino e da alimentação; não existe atalho que "acelere o metabolismo".',

  roles: {
    principal: { sets: { min: 3, max: 4 }, reps: { min: 8, max: 12 }, restSec: { min: 75, max: 90 }, intensity: { pct1rm: { min: 65, max: 75 }, rpe: { min: 7, max: 8 } } },
    composto: { sets: { min: 3, max: 4 }, reps: { min: 10, max: 15 }, restSec: { min: 45, max: 75 }, intensity: { pct1rm: { min: 60, max: 70 }, rpe: { min: 7, max: 8 } } },
    isolador: { sets: { min: 2, max: 3 }, reps: { min: 12, max: 20 }, restSec: { min: 45, max: 60 }, intensity: { rpe: { min: 7, max: 9 } } },
  },
  condicionamento: { durationMin: { min: 8, max: 12 }, workSec: 40, restSec: 20, intensity: { rpe: { min: 7, max: 8 } } },
  levelOverrides: {
    iniciante: {
      composto: { restSec: { min: 60, max: 75 }, intensity: { rpe: { min: 6, max: 7 } } },
      isolador: { reps: { min: 12, max: 15 } },
    },
  },

  compoundShare: { range: { min: 60, max: 85 }, base: 'compostos_grande_massa' },
  // pernas e costas priorizadas (grande massa); peito e ombros com volume de manutenção
  weeklySets: {
    peito: { min: 6, max: 12 },
    costas: { min: 14, max: 20 },
    quadriceps: { min: 12, max: 20 },
    posteriores: { min: 10, max: 16 },
    gluteos: { min: 8, max: 14 },
    ombros: { min: 6, max: 10 },
  },

  // upper/lower 4x: 1 composto grande + 2 supersets + finisher em 2 dos 4 dias
  dayStructure: [
    { kind: 'simples', roles: ['principal'], massa: 'grande' },
    { kind: 'superset', roles: ['composto', 'composto'], massa: 'grande', rounds: { min: 3, max: 4 }, restBetweenSec: { min: 0, max: 15 } },
    { kind: 'superset', roles: ['composto', 'isolador'], massa: 'qualquer', rounds: { min: 3, max: 3 }, restBetweenSec: { min: 0, max: 15 } },
    { kind: 'finisher', roles: ['condicionamento', 'condicionamento', 'condicionamento'], perWeek: { min: 1, max: 2 } },
  ],
  dayStructureRules: [
    {
      // 2–3x/semana: full body em circuito, não split
      when: { daysPerWeek: { min: 2, max: 3 } },
      split: 'full_body',
      slots: [
        // full body: o circuito cobre pernas, empurrar, puxar e quadril (sem restringir a massa grande)
        { kind: 'circuito', roles: ['composto', 'composto', 'composto', 'composto'], massa: 'qualquer', rounds: { min: 3, max: 4 }, restBetweenSec: { min: 15, max: 30 } },
        { kind: 'superset', roles: ['composto', 'isolador'], massa: 'qualquer', rounds: { min: 3, max: 3 }, restBetweenSec: { min: 0, max: 15 } },
        { kind: 'finisher', roles: ['condicionamento', 'condicionamento', 'condicionamento'], perWeek: { min: 1, max: 2 } },
      ],
    },
  ],

  progression: {
    principal: { rule: 'densidade', reduzirDescansoSec: 15, descansoPisoSec: 60, seriesExtrasMax: 1, increment: { superiorKg: 2.5, inferiorKg: 5 } },
    composto: { rule: 'densidade', reduzirDescansoSec: 15, descansoPisoSec: 45, seriesExtrasMax: 1, increment: { superiorKg: 2.5, inferiorKg: 5 } },
    isolador: { rule: 'densidade', reduzirDescansoSec: 15, descansoPisoSec: 30, seriesExtrasMax: 1, increment: { superiorKg: 1, inferiorKg: 2.5 } },
    condicionamento: { rule: 'densidade', reduzirDescansoSec: 5, descansoPisoSec: 10, seriesExtrasMax: 2, increment: { superiorKg: 0, inferiorKg: 0 } },
  },
  periodization: {
    kind: 'reativo',
    deloadPlanejadoACadaSemanas: 6,
    deload: { fatorSeries: 0.6, fatorCarga: 0.9, rpeMax: 6 },
  },

  warnings: [
    {
      id: 'gasto_iniciante',
      when: { level: ['iniciante'] },
      severity: 'info',
      text: 'Descansos curtos cansam rápido no começo. Se a técnica piorar, use o descanso máximo da faixa; o app reduz aos poucos conforme você se adapta.',
    },
    {
      id: 'gasto_nutricao',
      when: {},
      severity: 'info',
      text: 'Recomposição depende tanto da alimentação quanto do treino: proteína suficiente e um déficit calórico moderado fazem a maior parte do trabalho.',
    },
  ],

  explanation: {
    template:
      'Treino denso: os compostos de pernas e costas vêm primeiro ({seriesPrincipal}x{repsPrincipal}, {descansoPrincipal} de descanso), seguidos de supersets com {descansoAcessorio} de descanso ' +
      'e um bloco de condicionamento de 8–12 minutos {finisherPorSemana}. O objetivo é preservar ou ganhar massa magra fazendo mais trabalho no mesmo tempo. {progressao}',
    expectativa4a8Semanas:
      'Em 4–8 semanas, espere fazer o mesmo treino em menos tempo ou com mais séries, e alguma melhora de força e fôlego. Mudanças de composição corporal dependem principalmente da alimentação e aparecem de forma gradual.',
  },
} satisfies GoalProfile
