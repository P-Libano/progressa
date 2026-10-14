import { useState } from 'react'
import { clearApiKey, maskKey, setApiKey, useApiKey } from '../lib/apiKey'
import { Button } from './ui'

export function ApiKeyCard() {
  const key = useApiKey()
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">IA (opcional)</h2>
      <p className="mt-1 text-sm text-muted">
        Com sua chave da Claude API, o app pode gerar rotinas e revisar sua semana. Sem chave, tudo funciona normalmente.
      </p>

      {key && !editing ? (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-bg px-3 py-2 text-sm text-muted">{maskKey(key)}</code>
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Trocar
          </Button>
          <Button variant="danger" onClick={() => clearApiKey()}>
            Remover
          </Button>
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!draft.trim()) return
            await setApiKey(draft)
            setDraft('')
            setEditing(false)
          }}
        >
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            aria-label="Chave da Claude API"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 font-mono text-sm outline-none focus:border-accent"
          />
          <Button type="submit" disabled={!draft.trim()}>
            Salvar
          </Button>
        </form>
      )}

      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li>• A chave fica só neste aparelho e não vai para o backup.</li>
        <li>• Ao usar a IA, seu perfil, sua rotina e o histórico das últimas 2 semanas são enviados à Anthropic.</li>
        <li>
          • O uso é cobrado na sua conta da API (cerca de US$ 0,05 por pedido).{' '}
          <a className="text-ink underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            Criar chave
          </a>
        </li>
      </ul>
    </section>
  )
}
