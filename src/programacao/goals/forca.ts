import type { GoalProfile } from '../types'

/** Força máxima — RASCUNHO para aprovação (etapa A). */
export const FORCA = {
  id: 'forca',
  nome: 'Força máxima',
  resumo: 'Levantar mais carga nos movimentos básicos, com poucas repetições pesadas e descansos longos.',

  roles: {
    // agachamento, supino, terra, desenvolvimento, remada com barra
    principal: { sets: { min: 4, max: 5 }, reps: { min: 3, max: 5 }, restSec: { min: 180, max: 300 }, intensity: { pct1rm: { min: 80, max: 90 }, rpe: { min: 7, max: 9 } } },
    composto: { sets: { min: 3, max: 4 }, reps: { min: 4, max: 6 }, restSec: { min: 150, max: 180 }, intensity: { pct1rm: { min: 75, max: 82 }, rpe: { min: 7, max: 8 } } },
    isolador: { sets: { min: 2, max: 3 }, reps: { min: 8, max: 12 }, restSec: { min: 60, max: 90 }, intensity: { rpe: { min: 7, max: 8 } } },
  },
  levelOverrides: {
    // iniciante: 5x5 em ~70–77%, sem singles/doubles
    iniciante: {
      principal: { sets: { min: 5, max: 5 }, reps: { min: 5, max: 5 }, restSec: { min: 180, max: 180 }, intensity: { pct1rm: { min: 70, max: 77 }, rpe: { min: 6, max: 7 } } },
      composto: { reps: { min: 5, max: 6 }, intensity: { pct1rm: { min: 65, max: 75 }, rpe: { min: 6, max: 7 } } },
    },
    avancado: {
      principal: { sets: { min: 5, max: 6 }, reps: { min: 1, max: 5 }, intensity: { pct1rm: { min: 85, max: 92 }, rpe: { min: 8, max: 9 } } },
    },
  },

  compoundShare: { range: { min: 70, max: 90 }, base: 'compostos' },
  weeklySets: {
    peito: { min: 8, max: 14 },
    costas: { min: 10, max: 16 },
    quadriceps: { min: 8, max: 14 },
    posteriores: { min: 6, max: 12 },
    ombros: { min: 6, max: 12 },
  },

  dayStructure: [
    // sem preferência de massa: supino e desenvolvimento também são principais nos dias superiores
    { kind: 'simples', roles: ['principal'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['composto'] },
    { kind: 'simples', roles: ['isolador'], optional: true },
  ],

  progression: {
    principal: { rule: 'carga_por_rpe', increment: { superiorKg: 2.5, inferiorKg: 5 }, subirSeRpeAte: 7, manterSeRpeAte: 9, reducaoPct: 5 },
    composto: { rule: 'carga_por_rpe', increment: { superiorKg: 2.5, inferiorKg: 5 }, subirSeRpeAte: 7, manterSeRpeAte: 9, reducaoPct: 5 },
    isolador: { rule: 'dupla_progressao', increment: { superiorKg: 1, inferiorKg: 2.5 }, falhasParaDeload: 2, deloadPct: 10 },
  },
  periodization: {
    kind: 'bloco',
    semanasCarga: 3,
    semanasDeload: 1,
    rampaPct1rm: [80, 85, 90],
    deload: { fatorSeries: 0.6, fatorCarga: 0.85, rpeMax: 6 },
  },

  warnings: [
    {
      id: 'forca_peso_corporal',
      when: { equipment: ['peso_corporal'] },
      severity: 'aviso',
      text:
        'Força máxima com peso corporal é limitada: sem carga externa, não dá para treinar perto do seu máximo em 1–6 repetições. ' +
        'O app vai progredir por variações mais difíceis (ex.: flexão arqueiro, agachamento pistol) e por lastro (mochila ou colete), não só somando repetições.',
    },
    {
      id: 'forca_halteres',
      when: { equipment: ['halteres'] },
      severity: 'info',
      text: 'Com halteres, agachamento e terra ficam limitados pela pegada e pelo peso disponível; quando bater o teto, a progressão passa a ser por variação unilateral e pausa.',
    },
    {
      id: 'forca_iniciante',
      when: { level: ['iniciante'] },
      severity: 'info',
      text: 'Para quem está começando, o programa usa 5x5 em cerca de 70–77% do máximo: aprender a técnica com carga submáxima rende mais força do que tentativas máximas.',
    },
  ],

  explanation: {
    template:
      'Os básicos ({principais}) vêm primeiro, em {seriesPrincipal}x{repsPrincipal} a {intensidadePrincipal}, com {descansoPrincipal} de descanso para você render em todas as séries. ' +
      'Acessórios ficam no fim, em {repsAcessorio} reps. {progressao} {periodizacao}',
    expectativa4a8Semanas:
      'Em 4–8 semanas, o normal é ganhar carga nos básicos semana a semana, principalmente por melhora técnica e neural; o ganho de massa é secundário neste objetivo.',
  },
} satisfies GoalProfile
