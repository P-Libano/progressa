import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState, type ReactNode } from 'react'
import { Button, Screen } from '../components/ui'
import { MEDIA_ATTRIBUTION } from '../data/catalog'
import { db } from '../db'
import { BackupError, downloadJson, exportData, importData, parseBackup, wipeUserData } from '../lib/backup'

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-2 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

type Msg = { tone: 'ok' | 'error'; text: string } | null

export default function SettingsPage() {
  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.where('status').equals('done').count(),
    routines: await db.routines.count(),
  }))
  const file = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const onExport = async () => {
    const data = await exportData()
    downloadJson(data, `progressa-backup-${data.exportedAt.slice(0, 10)}.json`)
    setMsg({ tone: 'ok', text: `Backup gerado: ${data.sessions.length} sessões, ${data.routines.length} rotinas.` })
  }

  const onImport = async (f: File) => {
    try {
      const b = parseBackup(await f.text())
      const r = await importData(b)
      setMsg({ tone: 'ok', text: `Importado: ${r.sessions} sessões e ${r.routines} rotinas (de ${new Date(b.exportedAt).toLocaleString('pt-BR')}).` })
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof BackupError ? e.message : 'Não foi possível importar o arquivo.' })
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <Screen title="Ajustes">
      <Card title="Seus dados">
        <p className="text-sm text-muted">
          Tudo fica só neste aparelho (IndexedDB). Faça backup para trocar de celular ou não perder o histórico.
        </p>
        {counts && (
          <p className="mt-2 text-sm">
            {counts.sessions} treinos concluídos · {counts.routines} rotinas
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={onExport}>Exportar JSON</Button>
          <Button variant="ghost" onClick={() => file.current?.click()}>
            Importar JSON
          </Button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Arquivo de backup"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
        />
        <p className="mt-2 text-xs text-muted">Importar substitui o perfil, as rotinas e o histórico atuais.</p>
        {msg && (
          <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
            {msg.text}
          </p>
        )}
        <div className="mt-4 border-t border-line pt-3">
          {confirmWipe ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm text-danger">Apagar perfil, rotinas e histórico?</span>
              <Button variant="ghost" onClick={() => setConfirmWipe(false)}>
                Não
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await wipeUserData()
                  setConfirmWipe(false)
                  setMsg({ tone: 'ok', text: 'Dados apagados.' })
                }}
              >
                Apagar
              </Button>
            </div>
          ) : (
            <button onClick={() => setConfirmWipe(true)} className="text-sm text-danger/80 hover:text-danger">
              Apagar todos os dados…
            </button>
          )}
        </div>
      </Card>

      <Card title="Sobre">
        <p className="text-sm text-muted">
          Exercícios do dataset aberto{' '}
          <a className="text-ink underline" href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">
            hasaneyldrm/exercises-dataset
          </a>{' '}
          (dados sob licença MIT). Imagens e GIFs: {MEDIA_ATTRIBUTION}
        </p>
      </Card>
    </Screen>
  )
}
