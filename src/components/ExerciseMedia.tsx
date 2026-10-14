import { useState } from 'react'
import { MEDIA_ATTRIBUTION, mediaUrl } from '../data/catalog'
import type { Exercise } from '../data/types'

/** Miniatura (jpg) para listas. */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: Exercise; size?: number }) {
  return (
    <img
      src={mediaUrl(exercise.image)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="gif-frame shrink-0 rounded-lg object-cover"
      style={{ width: size, height: size }}
    />
  )
}

/** GIF de execução com a atribuição exigida pela licença da mídia (Gym visual). */
export function ExerciseGif({ exercise, className = '' }: { exercise: Exercise; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <figure className={className}>
      {failed ? (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-surface-2 text-sm text-muted">
          GIF indisponível offline
        </div>
      ) : (
        <img
          src={mediaUrl(exercise.gif)}
          alt={`Execução: ${exercise.namePt ?? exercise.name}`}
          width={180}
          height={180}
          onError={() => setFailed(true)}
          className="gif-frame aspect-square w-full max-w-[360px] rounded-xl object-contain"
        />
      )}
      <figcaption className="mt-1 text-[10px] text-muted">
        <a href="https://gymvisual.com/" target="_blank" rel="noreferrer" className="hover:underline">
          {exercise.attribution || MEDIA_ATTRIBUTION}
        </a>
      </figcaption>
    </figure>
  )
}
