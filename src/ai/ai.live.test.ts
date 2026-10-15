// Chamada REAL à Claude API. Só roda com a variável de ambiente PROGRESSA_LIVE_KEY
// (nunca grave a chave em arquivo). Custa alguns centavos por execução.
//   $env:PROGRESSA_LIVE_KEY="sk-ant-..."; npx vitest run src/ai/ai.live.test.ts
import { describe, expect, it } from 'vitest'
import { loadFixtureCatalog } from '../data/__fixtures__/load'
import type { Profile } from '../domain/profile'
import { allWeeks } from '../programacao/program'
import { anthropicTransport, type AiTransport } from './client'
import { AiError, generateRoutineWithAI } from './index'

const key = process.env.PROGRESSA_LIVE_KEY
const catalog = loadFixtureCatalog()
const byId = new Map(catalog.map((e) => [e.id, e]))
const equipmentOf = (id: string) => byId.get(id)?.equipment
const profileA: Profile = { split: 'ABC', daysPerWeek: 3, goal: 'hipertrofia', equipment: 'academia', level: 'intermediario' }

describe.skipIf(!key)('Claude API ao vivo', () => {
  it('gera rotina para o perfil (a) e passa na validação', async () => {
    let raw = ''
    const spy: AiTransport = async (k, req) => {
      const res = await anthropicTransport(k, req)
      raw = res.text
      console.log(`modelo: ${res.model} | tokens entrada/saída: ${res.usage.input}/${res.usage.output}`)
      return res
    }
    try {
      const r = await generateRoutineWithAI(profileA, { apiKey: key, equipmentOf, transport: spy })
      console.log('JSON devolvido pela IA:\n' + JSON.stringify(JSON.parse(raw), null, 2))
      console.log('validação: OK')
      for (const d of allWeeks(r)[0].days) {
        console.log(`${d.key} ${d.name}`)
        for (const i of d.groups.flatMap((g) => g.items)) console.log(`  ${byId.get(i.exerciseId)?.namePt ?? i.exerciseId} ${i.sets}x${i.reps?.min}–${i.reps?.max} (${i.role})`)
      }
      console.log('notas:', r.notes)
      console.log('por quê:', r.explanation)
      expect(allWeeks(r)[0].days).toHaveLength(3)
    } catch (e) {
      console.log('JSON devolvido pela IA (se houver):', raw || '(nenhum)')
      console.log('erro:', e instanceof AiError ? `[${e.kind}] ${e.message}` : e)
      throw e
    }
  }, 180_000)
})
