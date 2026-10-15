import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { LoadChart, WeeklyVolumeChart } from '../components/charts'
import { Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { MUSCLE_GROUPS, type MuscleGroup } from '../data/curated'
import { db } from '../db'
import { allWeeks } from '../programacao/program'
import { fmtKg } from '../programacao/progression/common'
import {
  addWeeks,
  exercisesWithHistory,
  fmtDay,
  fmtWeek,
  loadSeries,
  sessionsByWeek,
  weekStart,
  weeklySetsByGroup,
} from '../domain/stats'
import { useActiveProgram as useActiveRoutine } from '../lib/programStore'
import { useExerciseMap } from '../lib/useCatalog'

type Tab = 'progresso' | 'sessoes'

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  )
}

export default function HistoryPage() {
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('done').toArray(), [])
  const routine = useActiveRoutine()
  const byId = useExerciseMap()
  const [tab, setTab] = useState<Tab>('progresso')
  const [picked, setPicked] = useState<string | undefined>()
  const [week, setWeek] = useState(() => weekStart(Date.now()))

  const withHistory = useMemo(() => (sessions ? exercisesWithHistory(sessions) : []), [sessions])
  const exerciseId = picked ?? withHistory[0]?.exerciseId
  const series = useMemo(() => (sessions && exerciseId ? loadSeries(exerciseId, sessions) : []), [sessions, exerciseId])
  const weeks = useMemo(() => (sessions ? sessionsByWeek(sessions) : []), [sessions])
  const volume = useMemo(() => {
    if (!sessions) return []
    const v = weeklySetsByGroup(sessions, week)
    const inRoutine = new Set<MuscleGroup>(
      routine ? allWeeks(routine)[0].days.flatMap((d) => d.groups.flatMap((g) => g.items.map((e) => e.group))) : [],
    )
    return MUSCLE_GROUPS.filter((g) => g !== 'condicionamento' && (inRoutine.has(g) || v[g] > 0)).map((g) => ({ group: g, sets: v[g] }))
  }, [sessions, week, routine])

  if (!sessions || !byId) return <Screen title="Histórico">Carregando…</Screen>

  const name = (id: string) => {
    const e = byId.get(id)
    return e ? displayName(e) : id
  }
  const thisWeek = weekStart(Date.now())
  const totalSets = volume.reduce((a, v) => a + v.sets, 0)

  if (sessions.length === 0) {
    return (
      <Screen title="Histórico">
        <div className="mt-10 text-center">
          <p className="text-lg font-semibold">Nenhum treino concluído ainda</p>
          <p className="mt-1 text-sm text-muted">Conclua o primeiro treino e a evolução aparece aqui.</p>
          <Link to="/treino" className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 font-semibold text-accent-ink">
            Ir para o treino
          </Link>
        </div>
      </Screen>
    )
  }

  const first = series[0]
  const last = series[series.length - 1]
  const bodyweight = series.length > 0 && series.every((p) => p.weight === 0)

  return (
    <Screen title="Histórico">
      <div className="flex rounded-xl border border-line bg-surface p-0.5 text-sm" role="tablist">
        {(
          [
            ['progresso', 'Progresso'],
            ['sessoes', `Sessões (${sessions.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg py-2 ${tab === k ? 'bg-surface-2 font-medium text-ink' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'progresso' ? (
        <>
          <section className="mt-6">
            <h2 className="font-semibold">Carga por exercício</h2>
            <select
              value={exerciseId}
              onChange={(e) => setPicked(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-line bg-surface px-3"
              aria-label="Exercício"
            >
              {withHistory.map((e) => (
                <option key={e.exerciseId} value={e.exerciseId}>
                  {name(e.exerciseId)} ({e.sessions})
                </option>
              ))}
            </select>

            {last && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatTile
                  label={bodyweight ? 'Última' : 'Carga atual'}
                  value={bodyweight ? `${last.totalReps} reps` : fmtKg(last.weight)}
                  sub={last.reps}
                />
                <StatTile
                  label="Desde o início"
                  value={
                    bodyweight
                      ? `${last.totalReps - first.totalReps >= 0 ? '+' : ''}${last.totalReps - first.totalReps} reps`
                      : `${last.weight - first.weight >= 0 ? '+' : '−'}${fmtKg(Math.abs(last.weight - first.weight))}`
                  }
                  sub={`desde ${fmtDay(first.date)}`}
                />
                <StatTile
                  label={bodyweight ? 'Sessões' : '1RM estimado'}
                  value={bodyweight ? String(series.length) : fmtKg(Math.max(...series.map((p) => p.e1rm)))}
                  sub={bodyweight ? undefined : 'melhor (Epley)'}
                />
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
              {series.length >= 2 ? (
                <LoadChart points={series} />
              ) : (
                <p className="py-6 text-center text-sm text-muted">Registre mais uma sessão deste exercício para ver a evolução.</p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Séries por grupo na semana</h2>
              <span className="text-sm text-muted">{totalSets} no total</span>
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-line bg-surface p-1">
              <button onClick={() => setWeek(addWeeks(week, -1))} aria-label="Semana anterior" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2">
                ‹
              </button>
              <span className="text-sm">
                {week === thisWeek ? 'Esta semana' : fmtWeek(week)}
                {week === thisWeek && <span className="text-muted"> · {fmtWeek(week)}</span>}
              </span>
              <button
                onClick={() => setWeek(addWeeks(week, 1))}
                disabled={week >= thisWeek}
                aria-label="Próxima semana"
                className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
              >
                ›
              </button>
            </div>
            <div className="mt-3 rounded-2xl border border-line bg-surface p-3">
              {volume.length ? <WeeklyVolumeChart data={volume} /> : <p className="py-6 text-center text-sm text-muted">Sem séries nesta semana.</p>}
            </div>
            <p className="mt-2 text-xs text-muted">
              Conta as séries concluídas no grupo principal de cada exercício. Para hipertrofia, uma referência comum é 10–20
              séries semanais por grupo.
            </p>
          </section>
        </>
      ) : (
        <div className="mt-4 space-y-5">
          {weeks.map((w) => (
            <section key={w.week}>
              <h2 className="mb-2 text-sm text-muted">
                {w.week === thisWeek ? 'Esta semana' : `Semana ${fmtWeek(w.week)}`} · {w.sessions.length}{' '}
                {w.sessions.length === 1 ? 'treino' : 'treinos'}
              </h2>
              <ul className="space-y-2">
                {w.sessions.map((s) => (
                  <li key={s.id}>
                    <Link to={`/sessao/${s.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 hover:border-muted">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 font-bold">{s.dayKey}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.dayName.replace(/^Treino \w+ — /, '')}</span>
                        <span className="text-sm text-muted">
                          {new Date(s.startedAt).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ·{' '}
                          {s.summary.durationMin} min · {s.summary.sets} séries
                        </span>
                      </span>
                      <span className="text-right text-sm tabular-nums text-muted">{fmtKg(Math.round(s.summary.volumeKg))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Screen>
  )
}
