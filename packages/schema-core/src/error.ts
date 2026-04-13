import { z } from 'zod'

/**
 * Canonical error envelope — standard error shape for all Nzila OS platform APIs.
 */

export const PLATFORM_ERROR_CODES = [
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
export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODES)[number]

export const fieldErrorSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
  rule: z.string().optional(),
})
export type FieldError = z.infer<typeof fieldErrorSchema>

export const platformErrorSchema = z.object({
  code: z.enum(PLATFORM_ERROR_CODES),
  message: z.string().min(1),
  category: z.enum(['auth', 'permission', 'validation', 'resource', 'system']),
  retryable: z.boolean().default(false),
  correlationId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  fieldErrors: z.array(fieldErrorSchema).optional(),
})
export type PlatformError = z.infer<typeof platformErrorSchema>

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

export function getHttpStatus(code: PlatformErrorCode): number {
  return httpStatusMap[code]
}
