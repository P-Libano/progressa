import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { RestTimer } from '../components/RestTimer'
import { SessionExerciseCard } from '../components/SessionExerciseCard'
import { Button, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { fmtKg } from '../domain/progression'
import { sessionSummary } from '../domain/session'
import { useExerciseMap } from '../lib/useCatalog'
import {
  addSet,
  discardSession,
  finishSession,
  removeLastSet,
  setRest,
  setWeightFrom,
  toggleSetDone,
  updateSet,
  useSession,
} from '../lib/sessionStore'

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const m = Math.floor((now - since) / 60000)
  return <span className="font-mono tabular-nums text-muted">{m} min</span>
}

export default function SessionPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const session = useSession(id)
  const byId = useExerciseMap()
  const navigate = useNavigate()
  const [open, setOpen] = useState<number | null | undefined>(undefined)
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null)

  const onRest = useCallback((until: number | undefined) => setRest(id, until), [id])

  // abre o primeiro exercício com série pendente
  useEffect(() => {
    if (session && open === undefined) {
      const i = session.exercises.findIndex((e) => e.log.some((l) => !l.done))
      setOpen(i === -1 ? null : i)
    }
  }, [session, open])

  if (session === null) {
    return (
      <Screen title="Treino" back>
        <p className="text-muted">Sessão não encontrada.</p>
      </Screen>
    )
  }
  if (!session || !byId) return <Screen title="Treino">Carregando…</Screen>

  const done = session.status === 'done'
  const pending = session.exercises.reduce((a, e) => a + e.log.filter((l) => !l.done).length, 0)

  if (done) {
    const sum = sessionSummary(session)
    return (
      <Screen title={session.dayName} back>
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm text-accent">Treino concluído</p>
          <p className="mt-1 text-sm text-muted">
            {new Date(session.startedAt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ['Duração', `${sum.durationMin} min`],
              ['Exercícios', sum.exercises],
              ['Séries', sum.sets],
              ['Volume', fmtKg(Math.round(sum.volumeKg))],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ul className="mt-4 space-y-2">
          {session.exercises.map((e) => {
            const ex = byId.get(e.exerciseId)
            const sets = e.log.filter((l) => l.done)
            return (
              <li key={e.exerciseId} className="rounded-xl border border-line bg-surface p-3">
                <p className="font-medium">{ex ? displayName(ex) : e.exerciseId}</p>
                <p className="mt-0.5 text-sm text-muted tabular-nums">
                  {sets.length
                    ? sets.map((l) => `${l.weight ? `${String(l.weight).replace('.', ',')}×` : ''}${l.reps}`).join(' · ')
                    : 'não feito'}
                </p>
              </li>
            )
          })}
        </ul>
        <Button className="mt-5 w-full" onClick={() => navigate('/treino')}>
          Voltar para a rotina
        </Button>
      </Screen>
    )
  }

  return (
    <Screen
      title={session.dayName}
      action={
        <button onClick={() => setConfirm('finish')} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">
          Concluir
        </button>
      }
    >
      <div className="mb-3 flex items-center justify-between text-sm">
        <Elapsed since={session.startedAt} />
        <span className="text-muted">{pending} séries restantes</span>
      </div>

      <div className="space-y-3">
        {session.exercises.map((item, ex) => (
          <SessionExerciseCard
            key={`${item.exerciseId}-${ex}`}
            index={ex}
            item={item}
            exercise={byId.get(item.exerciseId)}
            open={open === ex}
            readOnly={false}
            onToggleOpen={() => setOpen(open === ex ? null : ex)}
            onWeight={(set, v) => setWeightFrom(id, ex, set, v)}
            onReps={(set, v) => updateSet(id, ex, set, { reps: v })}
            onToggleDone={async (set) => {
              const wasDone = item.log[set].done
              await toggleSetDone(id, ex, set)
              // concluiu a última série pendente: avança para o próximo exercício
              const remaining = item.log.filter((l, i) => i !== set && !l.done).length
              if (!wasDone && remaining === 0) {
                const next = session.exercises.findIndex((e, i) => i > ex && e.log.some((l) => !l.done))
                setOpen(next === -1 ? null : next)
              }
            }}
            onAddSet={() => addSet(id, ex)}
            onRemoveSet={() => removeLastSet(id, ex)}
          />
        ))}
      </div>

      <button onClick={() => setConfirm('discard')} className="mt-6 w-full py-3 text-sm text-danger/80 hover:text-danger">
        Descartar treino
      </button>
      {session.restUntil && <div className="h-24" />}

      <RestTimer until={session.restUntil} total={session.restTotal} onChange={onRest} />

      {confirm && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-6" role="dialog" aria-modal>
          <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5">
            <p className="text-lg font-semibold">{confirm === 'finish' ? 'Concluir treino?' : 'Descartar treino?'}</p>
            <p className="mt-1 text-sm text-muted">
              {confirm === 'finish'
                ? pending
                  ? `${pending} séries não foram marcadas e não entram no histórico.`
                  : 'Tudo marcado. As cargas da próxima sessão serão calculadas a partir deste treino.'
                : 'As séries registradas serão apagadas.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
                Voltar
              </Button>
              {confirm === 'finish' ? (
                <Button
                  className="flex-1"
                  onClick={async () => {
                    await finishSession(id)
                    setConfirm(null)
                  }}
                >
                  Concluir
                </Button>
              ) : (
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={async () => {
                    await discardSession(id)
                    navigate('/treino', { replace: true })
                  }}
                >
                  Descartar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Screen>
  )
}
