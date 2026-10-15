import { useEffect, useMemo } from 'react'
import { displayName } from '../data/catalog'
import { equipmentPt, musclePt } from '../data/i18n'
import type { Exercise } from '../data/types'
import type { Profile } from '../domain/profile'
import { SUBSTITUTE_REASON_PT, suggestSubstitutes } from '../domain/substitutes'
import { META_BY_ID } from '../programacao/meta'
import { ExerciseThumb } from './ExerciseMedia'
import { Chip } from './ui'

export function SwapSheet({
  current,
  catalog,
  profile,
  exclude,
  onlyLowRep = false,
  onPick,
  onClose,
}: {
  current: Exercise
  catalog: Exercise[]
  profile: Profile
  exclude: ReadonlySet<string>
  /** Slot com faixa abaixo de 6 reps: só exercícios que aguentam (sem unilaterais/isoladores). */
  onlyLowRep?: boolean
  onPick: (id: string) => void
  onClose: () => void
}) {
  const subs = useMemo(
    () =>
      suggestSubstitutes(current.id, catalog, profile, exclude, onlyLowRep ? 60 : 20)
        .filter((s) => !onlyLowRep || META_BY_ID.get(s.exercise.id)?.adequadoBaixasReps)
        .slice(0, 20),
    [current.id, catalog, profile, exclude, onlyLowRep],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose} role="dialog" aria-modal>
      <div
        className="mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 border-b border-line bg-surface px-4 py-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          <p className="text-xs text-muted">Trocar</p>
          <p className="font-semibold">{displayName(current)}</p>
        </div>
        {subs.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">Nenhum substituto com o seu equipamento.</p>
        ) : (
          <ul className="divide-y divide-line px-4">
            {subs.map(({ exercise: e, reason }) => (
              <li key={e.id}>
                <button onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <ExerciseThumb exercise={e} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(e)}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Chip tone={reason === 'mesmo_movimento' ? 'accent' : 'default'}>{SUBSTITUTE_REASON_PT[reason]}</Chip>
                      <Chip>{equipmentPt(e.equipment)}</Chip>
                      {reason === 'mesmo_musculo' && <Chip>{musclePt(e.target)}</Chip>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
