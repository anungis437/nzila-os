/**
 * A stand-in for `@/lib/api/standardized-responses` in route unit tests: the same codes and statuses, without the logger and Sentry the real module reaches.
 * It imports nothing, so it can be loaded from a `vi.mock` factory whatever else the test mocks.
 *
 *   vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble())
 */
const STATUS: Record<string, number> = {
  AUTH_ERROR: 401,
  AUTH_REQUIRED: 401,
  AUTH_INVALID: 401,
  AUTH_EXPIRED: 401,
  FORBIDDEN: 403,
  INSUFFICIENT_PERMISSIONS: 403,
  VALIDATION_ERROR: 400,
  INVALID_INPUT: 400,
  MISSING_REQUIRED_FIELD: 400,
  INVALID_FORMAT: 400,
  NOT_FOUND: 404,
  RESOURCE_NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  CONFLICT: 409,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  DATABASE_ERROR: 500,
  EXTERNAL_SERVICE_ERROR: 502,
  TIMEOUT: 504,
  SERVICE_UNAVAILABLE: 503,
  CIRCUIT_BREAKER_OPEN: 503,
  NOT_IMPLEMENTED: 501,
}

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

export function standardResponsesDouble() {
  return {
    ErrorCode: Object.fromEntries(Object.keys(STATUS).map((code) => [code, code])),
    standardErrorResponse: (code: string, message: string, details?: unknown) => json({ code, message, details }, STATUS[code] ?? 500),
    standardSuccessResponse: (data: unknown, meta?: unknown) => json({ success: true, data, meta }, 200),
  }
}
