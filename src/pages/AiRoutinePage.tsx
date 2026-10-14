import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { AiError, generateRoutineWithAI } from '../ai'
import { Button, Chip, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import type { Routine } from '../domain/generator'
import { EQUIPMENT_ACCESS_PT, GOAL_PT, LEVEL_PT, SPLIT_PT } from '../domain/profile'
import { useApiKey } from '../lib/apiKey'
import { activateRoutine, useProfile } from '../lib/routineStore'
import { useExerciseMap } from '../lib/useCatalog'

type State =
  | { s: 'idle' }
  | { s: 'loading'; since: number }
  | { s: 'error'; message: string; needsKey: boolean }
  | { s: 'done'; routine: Routine }

function Waiting({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="mt-8 text-center">
      <div className="mx-auto size-10 animate-spin rounded-full border-2 border-line border-t-accent" />
      <p className="mt-3 font-medium">Montando sua rotina…</p>
      <p className="text-sm text-muted">{Math.round((now - since) / 1000)}s · costuma levar 10–40s</p>
    </div>
  )
}

export function AiErrorBox({ message, needsKey, onRetry }: { message: string; needsKey: boolean; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4">
      <p className="text-sm text-danger">{message}</p>
      <div className="mt-3 flex gap-2">
        {needsKey ? (
          <Link to="/config" className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Ir para Ajustes
          </Link>
        ) : (
          <Button variant="ghost" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    </div>
  )
}

export default function AiRoutinePage() {
  const profile = useProfile()
  const apiKey = useApiKey()
  const byId = useExerciseMap()
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ s: 'idle' })

  if (profile === null) return <Navigate to="/onboarding" replace />
  if (profile === undefined || apiKey === undefined || !byId) return <Screen title="Rotina com IA">Carregando…</Screen>

  const run = async () => {
    setState({ s: 'loading', since: Date.now() })
    try {
      const routine = await generateRoutineWithAI(profile, { apiKey: apiKey ?? undefined, equipmentOf: (id) => byId.get(id)?.equipment })
      setState({ s: 'done', routine })
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('Falha inesperada ao gerar a rotina.')
      setState({ s: 'error', message: err.message, needsKey: err.kind === 'chave' })
    }
  }

  return (
    <Screen title="Rotina com IA" back>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="accent">{GOAL_PT[profile.goal]}</Chip>
        <Chip>{profile.daysPerWeek}x/semana</Chip>
        <Chip>{SPLIT_PT[profile.split]}</Chip>
        <Chip>{EQUIPMENT_ACCESS_PT[profile.equipment]}</Chip>
        <Chip>{LEVEL_PT[profile.level]}</Chip>
      </div>

      {state.s === 'idle' && (
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">
            A IA (Claude) monta uma rotina para este perfil usando só os exercícios disponíveis com o seu equipamento. Você vê o
            resultado antes de decidir usar.
          </p>
          {apiKey ? (
            <Button className="mt-4 w-full" onClick={run}>
              <Icon name="sparkle" /> Gerar rotina com IA
            </Button>
          ) : (
            <AiErrorBox message="Configure sua chave da Claude API em Ajustes para usar a IA." needsKey onRetry={run} />
          )}
        </div>
      )}
      {state.s === 'loading' && <Waiting since={state.since} />}
      {state.s === 'error' && <AiErrorBox message={state.message} needsKey={state.needsKey} onRetry={run} />}

      {state.s === 'done' && (
        <>
          {state.routine.notes && (
            <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed">{state.routine.notes}</p>
          )}
          {state.routine.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-muted">
              {state.routine.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-3">
            {state.routine.days.map((d) => (
              <section key={d.key} className="rounded-2xl border border-line bg-surface p-3">
                <h2 className="font-semibold">{d.name}</h2>
                <ol className="mt-2 space-y-1 text-sm">
                  {d.exercises.map((e, i) => {
                    const ex = byId.get(e.exerciseId)
                    return (
                      <li key={`${e.exerciseId}-${i}`} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">{ex ? displayName(ex) : e.exerciseId}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {e.sets}×{e.repMin}–{e.repMax}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={run}>
              Gerar outra
            </Button>
            <Button
              onClick={async () => {
                await activateRoutine(state.routine)
                navigate('/treino', { replace: true })
              }}
            >
              Usar esta rotina
            </Button>
          </div>
        </>
      )}
    </Screen>
  )
}
