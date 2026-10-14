import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ExerciseThumb } from '../components/ExerciseMedia'
import { SwapSheet } from '../components/SwapSheet'
import { Chip, Icon, Screen } from '../components/ui'
import { displayName } from '../data/catalog'
import { MUSCLE_GROUP_PT } from '../data/curated'
import { nextDayKey } from '../domain/generator'
import { EQUIPMENT_ACCESS_PT, GOAL_PT, LEVEL_PT, SPLIT_PT } from '../domain/profile'
import { useExerciseMap, useExercises } from '../lib/useCatalog'
import { replaceExercise, useActiveRoutine } from '../lib/routineStore'

const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}min${s % 60 ? ` ${s % 60}s` : ''}` : `${s}s`)

export default function RoutinePage() {
  const routine = useActiveRoutine()
  const catalog = useExercises()
  const byId = useExerciseMap()
  const next = routine ? nextDayKey(routine, undefined) : undefined
  const [tab, setTab] = useState<string | undefined>()
  const [swap, setSwap] = useState<{ day: string; index: number } | null>(null)

  const activeKey = tab ?? next
  const day = routine?.days.find((d) => d.key === activeKey)
  const dayIds = useMemo(() => new Set(day?.exercises.map((e) => e.exerciseId)), [day])

  if (routine === null) return <Navigate to="/onboarding" replace />
  if (!routine || !byId || !catalog || !day) return <Screen title="Treino">Carregando…</Screen>

  const p = routine.profile
  const swapping = swap && byId.get(day.exercises[swap.index]?.exerciseId)

  return (
    <Screen
      title="Sua rotina"
      action={
        <Link to="/onboarding" className="rounded-lg px-2 py-1 text-sm text-accent hover:bg-surface-2">
          Refazer
        </Link>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="accent">{GOAL_PT[p.goal]}</Chip>
        <Chip>{p.daysPerWeek}x/semana</Chip>
        <Chip>{SPLIT_PT[p.split]}</Chip>
        <Chip>{EQUIPMENT_ACCESS_PT[p.equipment]}</Chip>
        <Chip>{LEVEL_PT[p.level]}</Chip>
      </div>

      <p className="mt-3 text-sm text-muted">
        Semana: <span className="font-mono text-ink">{routine.schedule.join(' · ')}</span>
      </p>

      {routine.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          {routine.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {routine.days.map((d) => (
          <button
            key={d.key}
            role="tab"
            aria-selected={d.key === activeKey}
            onClick={() => setTab(d.key)}
            className={`relative shrink-0 rounded-xl border px-4 py-2 font-semibold ${
              d.key === activeKey ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface text-muted'
            }`}
          >
            {d.key}
            {d.key === next && <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{day.name}</h2>
        {day.key === next && <span className="text-xs text-accent">Próximo treino</span>}
      </div>

      <ol className="mt-2 space-y-2">
        {day.exercises.map((re, i) => {
          const ex = byId.get(re.exerciseId)
          if (!ex) return null
          return (
            <li key={`${re.exerciseId}-${i}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
              <Link to={`/exercicio/${ex.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <ExerciseThumb exercise={ex} size={52} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{displayName(ex)}</span>
                  <span className="text-sm text-muted">
                    <span className="font-semibold text-ink">
                      {re.sets}×{re.repMin}–{re.repMax}
                    </span>{' '}
                    · descanso {fmtRest(re.restSec)}
                  </span>
                  <span className="mt-1 flex gap-1">
                    <Chip>{MUSCLE_GROUP_PT[re.group]}</Chip>
                    <Chip>{re.compound ? 'Composto' : 'Isolador'}</Chip>
                  </span>
                </span>
              </Link>
              <button
                onClick={() => setSwap({ day: day.key, index: i })}
                aria-label={`Trocar ${displayName(ex)}`}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"
              >
                <Icon name="swap" />
              </button>
            </li>
          )
        })}
      </ol>

      <button
        disabled
        className="mt-5 h-12 w-full rounded-xl bg-accent font-semibold text-accent-ink opacity-40"
        title="Disponível na próxima etapa"
      >
        Iniciar treino {day.key}
      </button>

      {swap && swapping && (
        <SwapSheet
          current={swapping}
          catalog={catalog}
          profile={p}
          exclude={dayIds}
          onClose={() => setSwap(null)}
          onPick={async (id) => {
            await replaceExercise(routine.id!, swap.day, swap.index, id)
            setSwap(null)
          }}
        />
      )}
    </Screen>
  )
}
