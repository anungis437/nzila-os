/**
 * The authenticated-organization binding statement carries the short-lived bridge token as a bind parameter, and Drizzle
 * copies a failed statement's text AND parameters into the error it throws (`Failed query: ... params: <token>`).
 * Nothing from that error may travel further (logs, Sentry, API responses): only the SQLSTATE is kept.
 */
export function sanitizedBindingError(error: unknown): Error {
  const candidates = [
    (error as { code?: unknown } | null)?.code,
    ((error as { cause?: unknown } | null)?.cause as { code?: unknown } | undefined)?.code,
  ]
  const state = candidates.find((code): code is string => typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code))
  return new Error(`Failed to establish the authenticated organization context${state ? ` (SQLSTATE ${state})` : ''}`)
}
