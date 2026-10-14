import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { AiError, reviewWeekWithAI, type AiReview } from '../ai'
import { recentSessionCount } from '../ai/context'
import type { REVIEW_ACTIONS } from '../ai/schemas'
import { Button, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import type { CuratedExercise } from '../data/curated'
import { db } from '../db'
import { fmtKg } from '../domain/progression'
import { useApiKey } from '../lib/apiKey'
import { replaceExercise, useActiveRoutine } from '../lib/routineStore'
import { useExerciseMap } from '../lib/useCatalog'
import { AiErrorBox } from './AiRoutinePage'

type Action = (typeof REVIEW_ACTIONS)[number]
const ACTION: Record<Action, { label: string; icon: string; cls: string }> = {
  aumentar_carga: { label: 'Aumentar carga', icon: '↑', cls: 'text-accent' },
  manter: { label: 'Manter', icon: '=', cls: 'text-ink' },
  reduzir_carga: { label: 'Reduzir carga', icon: '↓', cls: 'text-warn' },
  trocar_exercicio: { label: 'Trocar exercício', icon: '⇄', cls: 'text-ink' },
  ajustar_volume: { label: 'Ajustar volume', icon: '±', cls: 'text-ink' },
}

type Result = AiReview & { alternatives: ReadonlyMap<string, CuratedExercise> }
type State = { s: 'idle' } | { s: 'loading' } | { s: 'error'; message: string; needsKey: boolean } | { s: 'done'; review: Result }

export default function AiReviewPage() {
  const routine = useActiveRoutine()
  const apiKey = useApiKey()
  const byId = useExerciseMap()
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  const [state, setState] = useState<State>({ s: 'idle' })
  const [applied, setApplied] = useState<Set<number>>(new Set())

  if (routine === null) return <Navigate to="/onboarding" replace />
  if (!routine || apiKey === undefined || !byId || !sessions) return <Screen title="Revisar semana">Carregando…</Screen>

  const name = (id: string) => {
    const e = byId.get(id)
    return e ? displayName(e) : id
  }
  const recent = recentSessionCount(sessions)

  const run = async () => {
    setState({ s: 'loading' })
    try {
      const review = await reviewWeekWithAI(routine, sessions, name, {
        apiKey: apiKey ?? undefined,
        equipmentOf: (id) => byId.get(id)?.equipment,
      })
      setApplied(new Set())
      setState({ s: 'done', review })
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('Falha inesperada ao revisar a semana.')
      setState({ s: 'error', message: err.message, needsKey: err.kind === 'chave' })
    }
  }

  /** Troca o exercício em todos os dias da rotina em que ele aparece. */
  const applySwap = async (fromId: string, toId: string, idx: number) => {
    for (const d of routine.days) {
      const i = d.exercises.findIndex((e) => e.exerciseId === fromId)
      if (i >= 0) await replaceExercise(routine.id!, d.key, i, toId)
    }
    setApplied((prev) => new Set(prev).add(idx))
  }

  return (
    <Screen title="Revisar semana" back>
      <p className="text-sm text-muted">
        A IA analisa seus treinos dos últimos 14 dias ({recent} {recent === 1 ? 'sessão' : 'sessões'}) e sugere ajustes. A progressão
        automática continua valendo; aqui é uma segunda opinião.
      </p>

      {state.s === 'idle' &&
        (apiKey ? (
          <Button className="mt-4 w-full" onClick={run} disabled={recent === 0}>
            <Icon name="sparkle" /> {recent === 0 ? 'Conclua um treino primeiro' : 'Revisar com IA'}
          </Button>
        ) : (
          <AiErrorBox message="Configure sua chave da Claude API em Ajustes para usar a IA." needsKey onRetry={run} />
        ))}
      {state.s === 'loading' && (
        <div className="mt-8 text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="mt-3 text-sm text-muted">Analisando seus treinos…</p>
        </div>
      )}
      {state.s === 'error' && <AiErrorBox message={state.message} needsKey={state.needsKey} onRetry={run} />}

      {state.s === 'done' && (
        <>
          <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed">{state.review.summary}</p>
          {state.review.adjustments.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted">Nenhum ajuste sugerido. Siga o plano.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {state.review.adjustments.map((a, i) => {
                const meta = ACTION[a.action]
                const replacement = a.replacementId ? state.review.alternatives.get(a.replacementId) : undefined
                return (
                  <li key={i} className="rounded-xl border border-line bg-surface p-3">
                    <p className="text-xs text-muted">
                      <span className={meta.cls}>{meta.icon}</span> {meta.label}
                    </p>
                    <p className="font-medium">{name(a.exerciseId)}</p>
                    <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
                    {a.suggestedWeightKg !== null && <p className="mt-1 text-sm">Carga sugerida: {fmtKg(a.suggestedWeightKg)}</p>}
                    {a.action === 'trocar_exercicio' && replacement && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm">→ {replacement.pt}</span>
                        <Button variant="ghost" disabled={applied.has(i)} onClick={() => applySwap(a.exerciseId, replacement.id, i)}>
                          {applied.has(i) ? 'Trocado ✓' : 'Aplicar troca'}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Button variant="ghost" className="mt-5 w-full" onClick={run}>
            Revisar de novo
          </Button>
        </>
      )}
    </Screen>
  )
}
