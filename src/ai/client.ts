import type { z } from 'zod'
import { AiError } from './validate'

export const AI_MODEL = 'claude-opus-5-5'

export interface AiRequest {
  system: string
  prompt: string
  schema: z.ZodType
  maxTokens?: number
}

export interface AiResult {
  /** JSON (texto) devolvido pelo modelo. Sempre validado em validate.ts. */
  text: string
  model: string
  usage: { input: number; output: number }
}

/** Transporte injetável: o real chama a API; os testes passam um falso. */
export type AiTransport = (apiKey: string, req: AiRequest) => Promise<AiResult>

/** Chamada real à Claude API, direto do navegador com a chave do próprio usuário. */
export const anthropicTransport: AiTransport = async (apiKey, req) => {
  // carregado sob demanda: o SDK só entra no bundle de quem usa a IA
  const [{ default: Anthropic }, { zodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
  ])
  // Sem backend: a chave é do próprio usuário e fica só neste aparelho.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  try {
    // create (não parse): o texto sempre passa pela validação do app, que dá mensagem em pt-BR
    const res = await client.beta.messages.create({
      model: AI_MODEL,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: [{ role: 'user', content: req.prompt }],
      output_config: { effort: 'medium', format: zodOutputFormat(req.schema) },
      // se o modelo recusar por política, a API repete no modelo de reserva na mesma chamada
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    if (res.stop_reason === 'refusal') {
      throw new AiError('A IA recusou este pedido. Tente reformular ou use a rotina gerada pelo app.', 'recusa')
    }
    if (res.stop_reason === 'max_tokens') {
      throw new AiError('A resposta da IA foi cortada antes do fim. Tente de novo.', 'invalido')
    }
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return { text, model: res.model, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } }
  } catch (e) {
    if (e instanceof AiError) throw e
    // do mais específico para o mais genérico
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Chave da API inválida ou revogada. Confira em Ajustes.', 'chave')
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('Esta chave não tem permissão para usar o modelo.', 'chave')
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Limite de uso da API atingido. Espere um pouco e tente de novo.', 'limite')
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`A API rejeitou o pedido: ${e.message}`, 'api')
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Sem conexão com a API. Verifique a internet.', 'rede')
    if (e instanceof Anthropic.APIError) throw new AiError(`Erro da API (${e.status ?? '?'}). Tente de novo em instantes.`, 'api')
    throw new AiError('Falha inesperada ao chamar a IA.', 'api')
  }
}
