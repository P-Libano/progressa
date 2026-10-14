import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { displayName } from '../data/catalog'
import type { Exercise } from '../data/types'
import { fmtKg, fmtReps, workingWeight, type SuggestionKind } from '../domain/progression'
import { parseNumber, type SessionExercise } from '../domain/session'
import { ExerciseGif } from './ExerciseMedia'
import { Icon } from './ui'

/** Input numérico que aceita vírgula e só grava ao sair do campo/confirmar. */
function NumberField({
  value,
  onCommit,
  placeholder,
  label,
  step,
}: {
  value: number | null
  onCommit: (v: number | null) => void
  placeholder?: string
  label: string
  step?: 'decimal' | 'numeric'
}) {
  const fmt = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(fmt(value))
  }, [value, focused])
  return (
    <input
      aria-label={label}
      inputMode={step ?? 'decimal'}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true)
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false)
        const v = parseNumber(text)
        if (v !== value) onCommit(v)
        setText(fmt(v))
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="h-11 w-full rounded-lg border border-line bg-bg text-center text-lg font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-accent"
    />
  )
}

const BANNER: Record<SuggestionKind, { cls: string; icon: string; title: (w: number | null) => string }> = {
  increase: { cls: 'border-accent/40 bg-accent/10 text-accent', icon: '↑', title: (w) => `Suba para ${fmtKg(w!)}` },
  deload: { cls: 'border-warn/40 bg-warn/10 text-warn', icon: '↓', title: (w) => `Deload: ${fmtKg(w!)}` },
  keep: { cls: 'border-line bg-surface-2 text-ink', icon: '=', title: (w) => `Mantenha ${fmtKg(w!)}` },
  start: { cls: 'border-line bg-surface-2 text-muted', icon: '•', title: () => 'Primeira vez' },
}

export function SessionExerciseCard({
  index,
  item,
  exercise,
  open,
  readOnly,
  onToggleOpen,
  onWeight,
  onReps,
  onToggleDone,
  onAddSet,
  onRemoveSet,
}: {
  index: number
  item: SessionExercise
  exercise: Exercise | undefined
  open: boolean
  readOnly: boolean
  onToggleOpen: () => void
  onWeight: (set: number, v: number | null) => void
  onReps: (set: number, v: number | null) => void
  onToggleDone: (set: number) => void
  onAddSet: () => void
  onRemoveSet: () => void
}) {
  const doneCount = item.log.filter((l) => l.done).length
  const complete = doneCount >= item.sets
  const name = exercise ? displayName(exercise) : item.exerciseId
  const s = item.suggestion
  const bodyweight = item.previous ? workingWeight(item.previous) === 0 : exercise?.equipment === 'body weight'
  const banner = BANNER[s.kind]
  const bannerTitle = bodyweight && s.kind !== 'start' ? { increase: 'Hora de dificultar', deload: 'Alivie a variação', keep: 'Mantenha e busque mais reps' }[s.kind] : banner.title(s.weight)

  return (
    <section className={`rounded-2xl border ${complete ? 'border-accent/30' : 'border-line'} bg-surface`}>
      <button onClick={onToggleOpen} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={open}>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
            complete ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
          }`}
        >
          {complete ? <Icon name="check" className="size-4" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{name}</span>
          <span className="text-sm text-muted">
            {item.sets}×{item.repMin}–{item.repMax} · {doneCount}/{item.log.length} séries
          </span>
        </span>
        {!open && s.weight !== null && !bodyweight && (
          <span className={`rounded-lg border px-2 py-1 text-xs ${banner.cls}`}>
            {banner.icon} {fmtKg(s.weight)}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-line p-3">
          <div className="flex gap-3">
            {exercise && (
              <Link to={`/exercicio/${exercise.id}`} className="w-[42%] shrink-0" aria-label={`Como fazer ${name}`}>
                <ExerciseGif exercise={exercise} />
              </Link>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`rounded-xl border p-2.5 ${banner.cls}`}>
                <p className="font-semibold">
                  {banner.icon} {bannerTitle}
                </p>
                <p className="mt-0.5 text-xs leading-snug opacity-90">{s.reason}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Histórico</p>
                {item.recent?.length ? (
                  <ul className="mt-1 space-y-0.5 text-xs tabular-nums">
                    {[...item.recent].reverse().map((r) => (
                      <li key={r.date} className="flex justify-between gap-2">
                        <span className="text-muted">{new Date(r.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                        <span>
                          {bodyweight ? '' : `${fmtKg(workingWeight(r))} × `}
                          {fmtReps(r)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-muted">Sem registros ainda.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2 text-center text-xs text-muted">
            <span>Série</span>
            <span>Anterior</span>
            <span>kg</span>
            <span>Reps</span>
            <span />
          </div>
          <ol className="mt-1 space-y-1.5">
            {item.log.map((l, i) => {
              const prev = item.previous?.sets[i]
              return (
                <li
                  key={i}
                  className={`grid grid-cols-[2rem_1fr_1fr_1fr_2.75rem] items-center gap-2 rounded-xl px-0.5 py-0.5 ${
                    l.done ? 'bg-accent/10' : ''
                  }`}
                >
                  <span className="text-center font-semibold text-muted">{i + 1}</span>
                  <span className="text-center text-sm text-muted tabular-nums">
                    {prev ? `${bodyweight ? '' : `${String(prev.weight).replace('.', ',')}×`}${prev.reps}` : '—'}
                  </span>
                  <NumberField
                    label={`Carga série ${i + 1}`}
                    value={l.weight}
                    placeholder={bodyweight ? 'PC' : 'kg'}
                    onCommit={(v) => onWeight(i, v)}
                  />
                  <NumberField
                    label={`Reps série ${i + 1}`}
                    value={l.reps}
                    step="numeric"
                    placeholder={`${item.repMin}–${item.repMax}`}
                    onCommit={(v) => onReps(i, v)}
                  />
                  <button
                    disabled={readOnly}
                    onClick={() => onToggleDone(i)}
                    aria-label={l.done ? `Desmarcar série ${i + 1}` : `Concluir série ${i + 1}`}
                    aria-pressed={l.done}
                    className={`grid size-11 place-items-center rounded-xl border ${
                      l.done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface-2 text-muted'
                    }`}
                  >
                    <Icon name="check" />
                  </button>
                </li>
              )
            })}
          </ol>
          {!readOnly && (
            <div className="mt-2 flex justify-end gap-2 text-sm">
              <button onClick={onRemoveSet} className="rounded-lg px-3 py-1.5 text-muted hover:bg-surface-2">
                − série
              </button>
              <button onClick={onAddSet} className="rounded-lg px-3 py-1.5 text-accent hover:bg-surface-2">
                + série
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
