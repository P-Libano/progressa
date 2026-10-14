import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import type { Profile } from '../domain/profile'
import { anthropicTransport } from './client'
import { AiError, generateRoutineWithAI } from './index'

/**
 * Caminho completo SDK → validação, com o fetch simulado (sem rede, sem chave real).
 * Cobre o caso "a API respondeu 200, mas com JSON que não serve".
 */

const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))
const equipmentOf = (id: string) => byId.get(id)?.equipment
const profile: Profile = { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }

function apiReturns(status: number, body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } }),
  )
}

const message = (text: string, stop_reason = 'end_turn') => ({
  id: 'msg_test',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text }],
  stop_reason,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
})

async function errorOf(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    return e
  }
  throw new Error('deveria ter falhado')
}

afterEach(() => vi.restoreAllMocks())

describe('transporte real (SDK) com fetch simulado', () => {
  it('JSON com formato errado → mensagem de validação, não "falha inesperada"', async () => {
    apiReturns(200, message('{"days": [{"key": "A", "name": "Peito", "exercises": "quatro exercícios"}], "notes": "x"}'))
    const e = await errorOf(generateRoutineWithAI(profile, { apiKey: 'k', equipmentOf, transport: anthropicTransport }))
    console.log('formato errado →', e instanceof AiError ? `[${e.kind}] ${e.message}` : e)
    expect(e).toBeInstanceOf(AiError)
    expect((e as AiError).kind).toBe('invalido')
  })

  it('texto que não é JSON → mensagem amigável', async () => {
    apiReturns(200, message('Claro! Aqui está sua rotina...'))
    const e = await errorOf(generateRoutineWithAI(profile, { apiKey: 'k', equipmentOf, transport: anthropicTransport }))
    console.log('não-JSON →', e instanceof AiError ? `[${e.kind}] ${e.message}` : e)
    expect((e as AiError).kind).toBe('invalido')
  })

  it('recusa → mensagem própria', async () => {
    apiReturns(200, { ...message(''), stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } })
    const e = await errorOf(generateRoutineWithAI(profile, { apiKey: 'k', equipmentOf, transport: anthropicTransport }))
    expect((e as AiError).kind).toBe('recusa')
  })

  it('401 → chave inválida', async () => {
    apiReturns(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } })
    const e = await errorOf(generateRoutineWithAI(profile, { apiKey: 'k', equipmentOf, transport: anthropicTransport }))
    console.log('401 →', (e as AiError).message)
    expect((e as AiError).kind).toBe('chave')
  })

  it('envia modelo, effort, formato estruturado e fallback', async () => {
    const spy = apiReturns(200, message('{}'))
    await errorOf(generateRoutineWithAI(profile, { apiKey: 'k', equipmentOf, transport: anthropicTransport }))
    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    const headers = new Headers(init.headers)
    console.log('requisição:', JSON.stringify({ url, model: body.model, output_config: { effort: body.output_config.effort, format: body.output_config.format.type }, fallbacks: body.fallbacks, beta: headers.get('anthropic-beta') }))
    expect(body.model).toBe('claude-opus-5-5')
    expect(body.output_config.effort).toBe('medium')
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.fallbacks).toBe('default')
    expect(headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
  })
})
