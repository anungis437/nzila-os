/**
 * Nzila HQ boot-time environment checks.
 *
 * Runs at instrumentation.ts; only enforces in production so local dev stays
 * frictionless. Add only invariants that would silently break the executive
 * cockpit at runtime if missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function assertNzilaHqBootEnv(): void {
  if (process.env.NODE_ENV !== 'production') return

  // Auth
  requireEnv('AUTH_SECRET')

  // Cross-app deep links (Phase 9–11). Missing values would render integration pages broken.
  requireEnv('NEXT_PUBLIC_CONSOLE_URL')
  requireEnv('NEXT_PUBLIC_PLATFORM_ADMIN_URL')
  requireEnv('NEXT_PUBLIC_CONTROL_PLANE_URL')
}
