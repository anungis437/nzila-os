/**
 * @nzila/platform-contracts — Canonical Error Envelope
 *
 * Standard error shape for all Nzila OS platform APIs.
 * Apps MUST return errors in this format for cross-app consistency.
 */
import { z } from 'zod'

// ── Error Category ──────────────────────────────────────────────────────────

export const platformErrorCodeValues = [
  'AUTH_REQUIRED',
  'ORG_SCOPE_REQUIRED',
  'ORG_SCOPE_INVALID',
  'ACCESS_DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const

export type PlatformErrorCode = (typeof platformErrorCodeValues)[number]

// ── Field Error (for validation) ────────────────────────────────────────────

export const fieldErrorSchema = z.object({
  /** Field path (dot-notation). */
  field: z.string().min(1),
  /** Error message. */
  message: z.string().min(1),
  /** Validation rule that failed. */
  rule: z.string().optional(),
})

export type FieldError = z.infer<typeof fieldErrorSchema>

// ── Platform Error Envelope ─────────────────────────────────────────────────

export const platformErrorSchema = z.object({
  /** Machine-readable error code. */
  code: z.enum(platformErrorCodeValues),
  /** Human-readable message (safe to show to end users). */
  message: z.string().min(1),
  /** Error category for client routing. */
  category: z.enum(['auth', 'permission', 'validation', 'resource', 'system']),
  /** Whether the client should retry. */
  retryable: z.boolean().default(false),
  /** Request correlation ID for support. */
  correlationId: z.string().optional(),
  /** Structured details (safe — no PII, secrets, or stack traces). */
  details: z.record(z.unknown()).optional(),
  /** Field-level validation errors. */
  fieldErrors: z.array(fieldErrorSchema).optional(),
})

export type PlatformError = z.infer<typeof platformErrorSchema>

// ── Error Factories ─────────────────────────────────────────────────────────

const categoryMap: Record<PlatformErrorCode, PlatformError['category']> = {
  AUTH_REQUIRED: 'auth',
  ORG_SCOPE_REQUIRED: 'permission',
  ORG_SCOPE_INVALID: 'permission',
  ACCESS_DENIED: 'permission',
  NOT_FOUND: 'resource',
  CONFLICT: 'resource',
  VALIDATION_ERROR: 'validation',
  RATE_LIMITED: 'system',
  INTERNAL_ERROR: 'system',
  SERVICE_UNAVAILABLE: 'system',
}

const httpStatusMap: Record<PlatformErrorCode, number> = {
  AUTH_REQUIRED: 401,
  ORG_SCOPE_REQUIRED: 403,
  ORG_SCOPE_INVALID: 403,
  ACCESS_DENIED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
}

/** Create a PlatformError with defaults. */
export function createPlatformError(
  code: PlatformErrorCode,
  message: string,
  opts?: {
    correlationId?: string
    details?: Record<string, unknown>
    fieldErrors?: FieldError[]
    retryable?: boolean
  },
): PlatformError {
  return {
    code,
    message,
    category: categoryMap[code],
    retryable: opts?.retryable ?? (code === 'RATE_LIMITED' || code === 'SERVICE_UNAVAILABLE'),
    correlationId: opts?.correlationId,
    details: opts?.details,
    fieldErrors: opts?.fieldErrors,
  }
}

/** Get the HTTP status code for a platform error code. */
export function getHttpStatus(code: PlatformErrorCode): number {
  return httpStatusMap[code]
}
