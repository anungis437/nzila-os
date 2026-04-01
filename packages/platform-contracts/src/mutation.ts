/**
 * @nzila/platform-contracts — Mutation / Action Result Contracts
 *
 * Standard response shapes for state-changing operations.
 */
import { z } from 'zod'

// ── Action Result ───────────────────────────────────────────────────────────

export const actionResultSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    /** Audit trail reference for the mutation. */
    auditId: z.string().optional(),
    /** Correlation ID. */
    correlationId: z.string().optional(),
  })

export interface ActionResult<T> {
  success: true
  data: T
  auditId?: string
  correlationId?: string
}

// ── Action Failure ──────────────────────────────────────────────────────────

export const actionFailureSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
  correlationId: z.string().optional(),
})

export interface ActionFailure {
  success: false
  error: { code: string; message: string }
  correlationId?: string
}

// ── Action Response (union) ─────────────────────────────────────────────────

export type ActionResponse<T> = ActionResult<T> | ActionFailure

// ── Partial Success ─────────────────────────────────────────────────────────

export const partialSuccessSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    succeeded: z.array(itemSchema),
    failed: z.array(
      z.object({
        item: itemSchema,
        error: z.object({
          code: z.string(),
          message: z.string(),
        }),
      }),
    ),
    totalRequested: z.number().int().nonnegative(),
    totalSucceeded: z.number().int().nonnegative(),
    totalFailed: z.number().int().nonnegative(),
  })

export interface PartialSuccess<T> {
  succeeded: T[]
  failed: Array<{ item: T; error: { code: string; message: string } }>
  totalRequested: number
  totalSucceeded: number
  totalFailed: number
}

// ── Factories ───────────────────────────────────────────────────────────────

export function ok<T>(data: T, opts?: { auditId?: string; correlationId?: string }): ActionResult<T> {
  return { success: true, data, auditId: opts?.auditId, correlationId: opts?.correlationId }
}

export function fail(code: string, message: string, correlationId?: string): ActionFailure {
  return { success: false, error: { code, message }, correlationId }
}
