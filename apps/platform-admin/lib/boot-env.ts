/**
 * Platform Admin boot-time environment checks.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function assertPlatformAdminBootEnv(): void {
  if (process.env.NODE_ENV !== 'production') return

  requireEnv('CONTROL_PLANE_URL')
  requireEnv('CONTROL_PLANE_API_KEY')
  requireEnv('ORCHESTRATOR_API_URL')
}
