import { CURATED, CURATED_BY_ID } from '../data/curated'
import type { Exercise } from '../data/types'
import { isAvailable, type Profile } from './profile'

export type SubstituteReason = 'mesmo_movimento' | 'mesmo_grupo' | 'mesmo_musculo'

export const SUBSTITUTE_REASON_PT: Record<SubstituteReason, string> = {
  mesmo_movimento: 'Mesmo movimento',
  mesmo_grupo: 'Mesmo grupo',
  mesmo_musculo: 'Mesmo músculo-alvo',
}

export interface Substitute {
  exercise: Exercise
  reason: SubstituteReason
}

const NOT_TRAINING = /stretch|pose\b|massage/i

/**
 * Substitutos para `id` viáveis para o perfil (equipamento e barra fixa).
 * Ordem: curados com o mesmo padrão de movimento → curados do mesmo grupo e
 * mesmo tipo (composto/isolador) → demais do dataset com o mesmo músculo-alvo.
 */
export function suggestSubstitutes(
  id: string,
  catalog: Exercise[],
  profile: Profile,
  exclude: ReadonlySet<string> = new Set(),
  limit = 15,
): Substitute[] {
  const base = catalog.find((e) => e.id === id)
  if (!base) return []
  const baseCur = CURATED_BY_ID.get(id)
  const ok = (e: Exercise) =>
    e.id !== id && !exclude.has(e.id) && isAvailable(profile, e.id, e.equipment) && !NOT_TRAINING.test(e.name)

  const out: Substitute[] = []
  const seen = new Set<string>()
  const push = (e: Exercise, reason: SubstituteReason) => {
    if (seen.has(e.id) || out.length >= limit) return
    seen.add(e.id)
    out.push({ exercise: e, reason })
  }

  if (baseCur) {
    const byId = new Map(catalog.map((e) => [e.id, e]))
    // na ordem do catálogo curado (preferência de academia), não na ordem dos ids
    const curated = CURATED.map((c) => byId.get(c.id)).filter((e): e is Exercise => !!e && ok(e))
    for (const e of curated) {
      const c = CURATED_BY_ID.get(e.id)!
      if (c.group === baseCur.group && c.pattern === baseCur.pattern) push(e, 'mesmo_movimento')
    }
    for (const e of curated) {
      const c = CURATED_BY_ID.get(e.id)!
      if (c.group === baseCur.group && c.compound === baseCur.compound) push(e, 'mesmo_grupo')
    }
  }
  const sameTarget = catalog
    .filter((e) => ok(e) && e.target === base.target && e.bodyPart === base.bodyPart)
    .sort((a, b) => Number(!!b.namePt) - Number(!!a.namePt) || a.name.localeCompare(b.name))
  for (const e of sameTarget) push(e, 'mesmo_musculo')
  return out
}
