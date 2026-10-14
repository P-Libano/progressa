import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import { CURATED_BY_ID } from '../data/curated'
import { db } from '../db'
import { generateRoutine } from '../domain/generator'
import type { Profile } from '../domain/profile'
import type { Session } from '../domain/session'
import { exportData } from '../lib/backup'
import { setApiKey } from '../lib/apiKey'
import type { AiRequest, AiTransport } from './client'
import { availableExercises, routinePrompt } from './context'
import { AiError, generateRoutineWithAI, reviewWeekWithAI } from './index'

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))
const equipmentOf = (id: string) => byId.get(id)?.equipment
const nameOf = (id: string) => byId.get(id)?.namePt ?? id

const profileA: Profile = { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }

/** Transporte falso: devolve `text` e guarda o pedido para inspeção. */
function fake(text: string) {
  const calls: AiRequest[] = []
  const transport: AiTransport = async (_key, req) => {
    calls.push(req)
    return { text, model: 'fake', usage: { input: 0, output: 0 } }
  }
  return { transport, calls }
}

// resposta "boa" no formato da IA, montada a partir do gerador local
const good = generateRoutine(profileA, equipmentOf, 0)
const goodJson = {
  days: good.days.map((d) => ({
    key: d.key,
    name: d.name.replace(/^Treino \w — /, ''),
    // isolador primeiro de propósito: o app deve reordenar
    exercises: [...d.exercises].reverse().map(({ exerciseId, sets, repMin, repMax, restSec }) => ({ exerciseId, sets, repMin, repMax, restSec })),
  })),
  notes: 'Divisão ABC clássica: empurrar, puxar e pernas, com compostos primeiro.',
}

async function expectAiError(text: string) {
  const { transport } = fake(text)
  try {
    await generateRoutineWithAI(profileA, { apiKey: 'k', equipmentOf, transport })
  } catch (e) {
    expect(e).toBeInstanceOf(AiError)
    return (e as AiError).message
  }
  throw new Error('deveria ter rejeitado')
}

describe('Gerar rotina com IA (perfil a)', () => {
  it('aceita JSON válido, converte e reordena compostos antes de isoladores', async () => {
    const { transport, calls } = fake(JSON.stringify(goodJson))
    const r = await generateRoutineWithAI(profileA, { apiKey: 'k', equipmentOf, transport })
    console.log('rotina IA convertida:', JSON.stringify({ source: r.source, schedule: r.schedule, warnings: r.warnings, dayA: r.days[0] }))
    expect(r.source).toBe('ia')
    expect(r.days.map((d) => d.key)).toEqual(['A', 'B', 'C'])
    for (const d of r.days) {
      const firstIso = d.exercises.findIndex((e) => !e.compound)
      expect(d.exercises.slice(firstIso).every((e) => !e.compound)).toBe(true)
    }
    expect(r.warnings.some((w) => w.includes('reordenei'))).toBe(true)
    expect(calls[0].prompt).toContain('chaves A, B, C')
  })

  it('rejeita respostas inválidas com mensagem amigável', async () => {
    const day0 = goodJson.days[0]
    const cases: [string, string][] = [
      ['texto que não é JSON', 'Claro! Aqui está sua rotina: ...'],
      ['JSON sem "days"', JSON.stringify({ notes: 'x' })],
      ['sets como texto', JSON.stringify({ ...goodJson, days: [{ ...day0, exercises: [{ ...day0.exercises[0], sets: 'quatro' }] }] })],
      ['exercício fora da lista', JSON.stringify({ ...goodJson, days: [{ ...day0, exercises: [{ ...day0.exercises[0], exerciseId: '9999' }, ...day0.exercises.slice(1)] }, ...goodJson.days.slice(1)] })],
      ['dia com 3 exercícios', JSON.stringify({ ...goodJson, days: [{ ...day0, exercises: day0.exercises.slice(0, 3) }, ...goodJson.days.slice(1)] })],
      ['só 2 dias', JSON.stringify({ ...goodJson, days: goodJson.days.slice(0, 2) })],
      ['faixa 12–8', JSON.stringify({ ...goodJson, days: [{ ...day0, exercises: [{ ...day0.exercises[0], repMin: 12, repMax: 8 }, ...day0.exercises.slice(1)] }, ...goodJson.days.slice(1)] })],
    ]
    for (const [label, text] of cases) {
      const msg = await expectAiError(text)
      console.log(`${label.padEnd(24)} → ${msg}`)
    }
  })

  it('sem chave: erro amigável, sem chamar a API', async () => {
    const { transport, calls } = fake('{}')
    await expect(generateRoutineWithAI(profileA, { apiKey: '  ', equipmentOf, transport })).rejects.toThrow('Configure sua chave')
    expect(calls).toHaveLength(0)
  })

  it('o prompt só lista exercícios viáveis para o perfil', () => {
    const p: Profile = { ...profileA, equipment: 'halteres' }
    const list = availableExercises(p, equipmentOf)
    const prompt = routinePrompt(p, list, equipmentOf)
    expect(list.every((c) => ['dumbbell', 'body weight'].includes(equipmentOf(c.id)!))).toBe(true)
    expect(prompt).not.toContain('Supino reto com barra')
    expect(prompt).toContain('Supino reto com halteres')
    expect(prompt).toContain('(sem barra fixa)')
  })
})

describe('Revisar semana', () => {
  const routine = { ...good, id: 1 }
  const sessions: Session[] = []

  it('aceita a revisão, descarta ids desconhecidos e troca inválida', async () => {
    const supino = routine.days[0].exercises[0].exerciseId
    const review = {
      summary: 'Boa consistência. O supino estagnou em 60 kg.',
      adjustments: [
        { exerciseId: supino, action: 'trocar_exercicio', detail: 'Troque por halteres por 3 semanas.', suggestedWeightKg: null, replacementId: '0289' },
        { exerciseId: supino, action: 'reduzir_carga', detail: 'Deload.', suggestedWeightKg: 54, replacementId: null },
        { exerciseId: '9999', action: 'manter', detail: 'id inexistente', suggestedWeightKg: null, replacementId: null },
        { exerciseId: supino, action: 'trocar_exercicio', detail: 'troca para id inválido', suggestedWeightKg: null, replacementId: '0025' },
      ],
    }
    const { transport, calls } = fake(JSON.stringify(review))
    const r = await reviewWeekWithAI(routine, sessions, nameOf, { apiKey: 'k', equipmentOf, transport })
    console.log('revisão validada:', JSON.stringify({ summary: r.summary, adjustments: r.adjustments }))
    expect(r.adjustments).toHaveLength(3)
    expect(r.adjustments[0].replacementId).toBe('0289')
    expect(r.adjustments[2].replacementId).toBeNull() // 0025 já está na rotina: não é alternativa
    expect(calls[0].prompt).toContain('(nenhuma sessão concluída)')
    expect(CURATED_BY_ID.get('0289')?.pt).toBe('Supino reto com halteres')
  })
})

describe('chave da API', () => {
  it('fica fora do backup', async () => {
    await setApiKey('sk-ant-teste-123')
    const json = JSON.stringify(await exportData())
    expect(json).not.toContain('sk-ant')
    expect(await db.meta.get('anthropicApiKey')).toBeDefined()
  })
})
