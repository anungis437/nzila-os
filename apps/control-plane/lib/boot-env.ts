/**
 * Control Plane boot-time environment checks.
 */

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function assertControlPlaneBootEnv(): void {
  if (process.env.NODE_ENV !== 'production') return

  // Required for protected authority endpoints.
  requireEnv('CONTROL_PLANE_API_KEY')
  // Required for module telemetry fan-in.
  requireEnv('UNION_EYES_URL')
}
