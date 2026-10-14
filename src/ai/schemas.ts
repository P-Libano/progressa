import { z } from '../lib/zod'

/**
 * Formato pedido à IA (structured outputs). Só tipos aqui: faixas e regras de
 * negócio são checadas depois em validate.ts, com mensagens em pt-BR.
 */

export const aiRoutineSchema = z.object({
  days: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      exercises: z.array(
        z.object({
          exerciseId: z.string(),
          sets: z.number().int(),
          repMin: z.number().int(),
          repMax: z.number().int(),
          restSec: z.number().int(),
        }),
      ),
    }),
  ),
  notes: z.string(),
})
export type AiRoutine = z.infer<typeof aiRoutineSchema>

export const REVIEW_ACTIONS = ['aumentar_carga', 'manter', 'reduzir_carga', 'trocar_exercicio', 'ajustar_volume'] as const

export const aiReviewSchema = z.object({
  summary: z.string(),
  adjustments: z.array(
    z.object({
      exerciseId: z.string(),
      action: z.enum(REVIEW_ACTIONS),
      detail: z.string(),
      suggestedWeightKg: z.number().nullable(),
      replacementId: z.string().nullable(),
    }),
  ),
})
export type AiReview = z.infer<typeof aiReviewSchema>
