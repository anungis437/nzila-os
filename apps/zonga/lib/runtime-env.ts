export function isDevOrTestRuntime(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

export function isProductionLikeRuntime(): boolean {
  return !isDevOrTestRuntime()
}

export function requireEnvVar(name: string): string {
  const value = process.env[name]?.trim()
  if (value) return value
  throw new Error(`Missing required environment variable: ${name}`)
}

export function requireEnvVarOutsideDevTest(name: string, fallback?: string): string {
  const value = process.env[name]?.trim()
  if (value) return value

  if (isDevOrTestRuntime() && fallback !== undefined) {
    return fallback
  }

  throw new Error(`Missing required environment variable outside dev/test: ${name}`)
}
