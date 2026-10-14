import { slimExercise } from '../catalog'
import type { Exercise, RawExercise } from '../types'
import index from './exercises-index.json'

type IndexRow = Pick<
  RawExercise,
  'id' | 'name' | 'body_part' | 'equipment' | 'target' | 'muscle_group' | 'secondary_muscles'
>

/** Catálogo real (sem instruções/mídia) para testes. */
export function loadFixtureCatalog(): Exercise[] {
  return (index as IndexRow[]).map((r) =>
    slimExercise({
      ...r,
      category: r.body_part,
      instructions: {} as RawExercise['instructions'],
      instruction_steps: {} as RawExercise['instruction_steps'],
      media_id: '',
      image: `images/${r.id}.jpg`,
      gif_url: `videos/${r.id}.gif`,
      attribution: '',
      created_at: '',
    }),
  )
}
