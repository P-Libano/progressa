import { z } from './zod'
import { MUSCLE_GROUPS } from '../data/curated'
import { META, db } from '../db'
import type { Routine } from '../domain/generator'
import type { Session } from '../domain/session'

/**
 * Backup dos dados do usuário: perfil, rotinas e sessões.
 * Fica de fora o catálogo (é rebaixado do CDN) e a chave da API (segredo local).
 */

export const BACKUP_FORMAT = 1

const group = z.enum(MUSCLE_GROUPS)
const num = z.number().finite()

const profileSchema = z.object({
  goal: z.enum(['hipertrofia', 'forca']),
  daysPerWeek: z.number().int().min(2).max(6),
  split: z.enum(['AB', 'ABC', 'ABCD', 'upper_lower', 'full_body']),
  equipment: z.enum(['academia', 'halteres', 'peso_corporal']),
  level: z.enum(['iniciante', 'intermediario', 'avancado']),
  pullupBar: z.boolean().optional(),
})

const prescription = {
  sets: z.number().int().min(1).max(10),
  repMin: z.number().int().min(1),
  repMax: z.number().int().min(1),
  restSec: z.number().int().min(0),
}

const routineSchema = z.object({
  id: z.number().int(),
  createdAt: num,
  source: z.enum(['local', 'ia']),
  profile: profileSchema,
  days: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      exercises: z.array(z.object({ exerciseId: z.string(), group, compound: z.boolean(), ...prescription })),
    }),
  ),
  schedule: z.array(z.string()),
  warnings: z.array(z.string()),
  notes: z.string().optional(),
})

const result = z.object({ date: num, sets: z.array(z.object({ weight: num, reps: num })) })

const sessionSchema = z.object({
  id: z.number().int(),
  routineId: z.number().int(),
  dayKey: z.string(),
  dayName: z.string(),
  startedAt: num,
  finishedAt: num.optional(),
  status: z.enum(['active', 'done']),
  exerciseIds: z.array(z.string()),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      group,
      compound: z.boolean(),
      ...prescription,
      suggestion: z.object({
        kind: z.enum(['start', 'increase', 'keep', 'deload']),
        weight: num.nullable(),
        failStreak: z.number().int(),
        reason: z.string(),
      }),
      previous: result.optional(),
      recent: z.array(result).optional(),
      log: z.array(z.object({ weight: num.nullable(), reps: num.nullable(), done: z.boolean() })),
    }),
  ),
  restUntil: num.optional(),
  restTotal: num.optional(),
})

export const backupSchema = z.object({
  app: z.literal('progressa'),
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.string(),
  profile: profileSchema.nullable(),
  activeRoutineId: z.number().int().nullable(),
  routines: z.array(routineSchema),
  sessions: z.array(sessionSchema),
})

export type Backup = z.infer<typeof backupSchema>

export async function exportData(now = new Date()): Promise<Backup> {
  const [profile, active, routines, sessions] = await Promise.all([
    db.meta.get(META.profile),
    db.meta.get(META.activeRoutine),
    db.routines.toArray(),
    db.sessions.toArray(),
  ])
  return {
    app: 'progressa',
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    profile: (profile?.value as Backup['profile']) ?? null,
    activeRoutineId: (active?.value as number | undefined) ?? null,
    routines: routines as Backup['routines'],
    sessions: sessions as Backup['sessions'],
  }
}

export class BackupError extends Error {}

/** Valida o JSON e devolve uma mensagem amigável com o primeiro problema encontrado. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.')
  }
  if (typeof raw !== 'object' || raw === null || (raw as { app?: unknown }).app !== 'progressa') {
    throw new BackupError('Este arquivo não é um backup do Progressa.')
  }
  if ((raw as { format?: unknown }).format !== BACKUP_FORMAT) {
    throw new BackupError(`Versão de backup não suportada (esperado formato ${BACKUP_FORMAT}).`)
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new BackupError(`Backup inválido em "${issue.path.join('.') || 'raiz'}": ${issue.message}`)
  }
  return parsed.data
}

/** Substitui perfil, rotinas e sessões pelos do backup (o catálogo fica). */
export async function importData(b: Backup): Promise<{ routines: number; sessions: number }> {
  await db.transaction('rw', db.meta, db.routines, db.sessions, async () => {
    await db.routines.clear()
    await db.sessions.clear()
    await db.meta.bulkDelete([META.profile, META.activeRoutine])
    await db.routines.bulkPut(b.routines as Routine[])
    await db.sessions.bulkPut(b.sessions as Session[])
    if (b.profile) await db.meta.put({ key: META.profile, value: b.profile })
    if (b.activeRoutineId !== null) await db.meta.put({ key: META.activeRoutine, value: b.activeRoutineId })
  })
  return { routines: b.routines.length, sessions: b.sessions.length }
}

/** Apaga dados do usuário (mantém o catálogo baixado). */
export async function wipeUserData() {
  await db.transaction('rw', db.meta, db.routines, db.sessions, async () => {
    await db.routines.clear()
    await db.sessions.clear()
    await db.meta.bulkDelete([META.profile, META.activeRoutine])
  })
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
