import { CURATED_BY_ID, MUSCLE_GROUP_PT } from '../data/curated'
import type { Routine } from './generator'

/** Representação textual da rotina (testes, depuração e export legível). */
export function formatRoutine(r: Routine, nameOf: (id: string) => string, equipmentOf: (id: string) => string) {
  const lines = [`Semana: ${r.schedule.join(' ')}`]
  for (const d of r.days) {
    lines.push(`${d.name}`)
    d.exercises.forEach((e, i) => {
      const cur = CURATED_BY_ID.get(e.exerciseId)
      const own = cur && cur.group !== e.group ? ` (exercício de ${MUSCLE_GROUP_PT[cur.group]})` : ''
      lines.push(
        `  ${i + 1}. ${nameOf(e.exerciseId)} — ${e.sets}x${e.repMin}–${e.repMax}, descanso ${e.restSec}s` +
          ` [${e.compound ? 'composto' : 'isolador'} · ${MUSCLE_GROUP_PT[e.group]}${own} · ${equipmentOf(e.exerciseId)}]`,
      )
    })
  }
  for (const w of r.warnings) lines.push(`⚠ ${w}`)
  return lines.join('\n')
}
