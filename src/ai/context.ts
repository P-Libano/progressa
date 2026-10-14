import { CURATED, MUSCLE_GROUP_PT, type CuratedExercise } from '../data/curated'
import { EQUIPMENT_PT } from '../data/i18n'
import type { Routine } from '../domain/generator'
import { PRESCRIPTION } from '../domain/prescription'
import { EQUIPMENT_ACCESS_PT, GOAL_PT, LEVEL_PT, SPLIT_DAY_KEYS, SPLIT_PT, hasPullupBar, isAvailable, type Profile } from '../domain/profile'
import type { Session } from '../domain/session'

/** Exercícios que a IA pode usar: curados e viáveis para o perfil. */
export function availableExercises(profile: Profile, equipmentOf: (id: string) => string | undefined): CuratedExercise[] {
  return CURATED.filter((c) => isAvailable(profile, c.id, equipmentOf(c.id)))
}

export function dayKeysFor(profile: Profile): string[] {
  const keys = SPLIT_DAY_KEYS[profile.split]
  return profile.split === 'full_body' ? keys.slice(0, Math.min(3, profile.daysPerWeek)) : keys
}

const PATTERN_PT: Record<string, string> = {
  empurrar_horizontal: 'empurrar horizontal',
  empurrar_inclinado: 'empurrar inclinado',
  empurrar_vertical: 'empurrar vertical',
  crucifixo: 'crucifixo',
  puxar_horizontal: 'remada',
  puxar_vertical: 'puxada vertical',
  pulldown_isolado: 'pulldown isolado',
  elevacao_lateral: 'elevação lateral',
  elevacao_frontal: 'elevação frontal',
  deltoide_posterior: 'deltoide posterior',
  rosca: 'rosca',
  triceps_isolado: 'tríceps isolado',
  triceps_composto: 'tríceps composto',
  agachamento: 'agachamento',
  avanco: 'avanço/afundo',
  extensora: 'extensão de joelho',
  terra: 'levantamento terra/stiff',
  flexora: 'flexão de joelho',
  gluteo: 'glúteo',
  panturrilha: 'panturrilha',
  abdominal: 'abdominal',
  encolhimento: 'encolhimento',
  punho: 'punho',
}

export const ROUTINE_SYSTEM = `Você é um treinador de musculação experiente que monta rotinas para um app brasileiro.
Monte a rotina usando SOMENTE os exercícios da lista fornecida, referenciados pelo id exato.
Regras obrigatórias:
- Exatamente os dias pedidos, nas chaves pedidas, cada um com 4 a 6 exercícios distintos.
- Em cada dia, exercícios compostos antes dos isoladores.
- Distribua os grupos musculares de forma equilibrada na semana; peito, costas, pernas e ombros aparecem pelo menos uma vez.
- Séries e repetições coerentes com o objetivo e o nível (use a tabela de referência).
- Nomes dos dias em português, curtos (ex.: "Peito, ombros e tríceps").
- Em "notes", 2 a 4 frases em português explicando a lógica da divisão.`

export function routinePrompt(profile: Profile, list: CuratedExercise[], equipmentOf: (id: string) => string | undefined) {
  const keys = dayKeysFor(profile)
  const ref = PRESCRIPTION[profile.goal][profile.level]
  const lines = list.map(
    (c) =>
      `${c.id} | ${c.pt} | ${MUSCLE_GROUP_PT[c.group]} | ${PATTERN_PT[c.pattern]} | ${c.compound ? 'composto' : 'isolador'} | ${
        EQUIPMENT_PT[equipmentOf(c.id) ?? ''] ?? equipmentOf(c.id)
      }`,
  )
  return `Perfil:
- Objetivo: ${GOAL_PT[profile.goal]}
- Dias por semana: ${profile.daysPerWeek}
- Divisão: ${SPLIT_PT[profile.split]} → dias com as chaves ${keys.join(', ')} (nesta ordem)
- Equipamento: ${EQUIPMENT_ACCESS_PT[profile.equipment]}${hasPullupBar(profile) ? ' (tem barra fixa/paralelas)' : ' (sem barra fixa)'}
- Nível: ${LEVEL_PT[profile.level]}

Referência de prescrição para este perfil:
- Compostos: ${ref.compound.sets} séries de ${ref.compound.repMin}–${ref.compound.repMax} reps, descanso ${ref.compound.restSec}s
- Isoladores: ${ref.isolation.sets} séries de ${ref.isolation.repMin}–${ref.isolation.repMax} reps, descanso ${ref.isolation.restSec}s

Exercícios disponíveis (id | nome | grupo | padrão | tipo | equipamento):
${lines.join('\n')}`
}

export const REVIEW_SYSTEM = `Você é um treinador de musculação revisando as duas últimas semanas de treino de um aluno de um app brasileiro.
O app já aplica progressão dupla automática (sobe a carga quando todas as séries batem o topo da faixa; deload de 10% após duas sessões sem progresso).
Seu papel é olhar o conjunto: estagnação, regressão, volume desequilibrado, exercícios pulados, carga alta ou baixa demais para a faixa.
Responda em português do Brasil.
- "summary": no máximo 3 frases, direto ao ponto.
- "adjustments": de 0 a 8 itens, só onde há algo a mudar ou destacar; use os ids exatos da rotina.
- Para "trocar_exercicio", "replacementId" deve ser um id da lista de alternativas; senão null.
- "suggestedWeightKg" só quando fizer sentido sugerir uma carga; senão null.
- "detail": uma frase curta e concreta.`

export function reviewPrompt(
  routine: Routine,
  sessions: Session[],
  nameOf: (id: string) => string,
  alternatives: CuratedExercise[],
  now = Date.now(),
) {
  const since = now - 14 * 24 * 60 * 60 * 1000
  const recent = sessions.filter((s) => s.status === 'done' && s.startedAt >= since).sort((a, b) => a.startedAt - b.startedAt)
  const routineLines = routine.days.flatMap((d) =>
    d.exercises.map((e) => `${d.key} | ${e.exerciseId} | ${nameOf(e.exerciseId)} | ${e.sets}x${e.repMin}–${e.repMax}`),
  )
  const sessionLines = recent.flatMap((s) => {
    const date = new Date(s.startedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    return [
      `${date} — ${s.dayName}`,
      ...s.exercises.map((e) => {
        const sets = e.log.filter((l) => l.done && l.reps !== null).map((l) => `${l.weight ?? 0}kg×${l.reps}`)
        return `  ${e.exerciseId} ${nameOf(e.exerciseId)} (alvo ${e.sets}x${e.repMin}–${e.repMax}): ${sets.length ? sets.join(', ') : 'não feito'}`
      }),
    ]
  })
  return `Perfil: ${GOAL_PT[routine.profile.goal]}, ${LEVEL_PT[routine.profile.level]}, ${routine.profile.daysPerWeek}x/semana, ${SPLIT_PT[routine.profile.split]}, ${EQUIPMENT_ACCESS_PT[routine.profile.equipment]}.

Rotina atual (dia | id | exercício | prescrição):
${routineLines.join('\n')}

Sessões dos últimos 14 dias (${recent.length}):
${sessionLines.length ? sessionLines.join('\n') : '(nenhuma sessão concluída)'}

Alternativas disponíveis para troca (id | nome | grupo):
${alternatives.map((c) => `${c.id} | ${c.pt} | ${MUSCLE_GROUP_PT[c.group]}`).join('\n')}`
}

export const recentSessionCount = (sessions: Session[], now = Date.now()) =>
  sessions.filter((s) => s.status === 'done' && s.startedAt >= now - 14 * 24 * 60 * 60 * 1000).length
