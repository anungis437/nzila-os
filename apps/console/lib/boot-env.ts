/**
 * Console boot-time environment checks.
 * Fail-fast in production when critical operating-layer dependencies are missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function assertConsoleBootEnv(): void {
  if (process.env.NODE_ENV !== 'production') return

  requireEnv('CONTROL_PLANE_URL')
  requireEnv('CONTROL_PLANE_API_KEY')
  requireEnv('ORCHESTRATOR_API_URL')
}
