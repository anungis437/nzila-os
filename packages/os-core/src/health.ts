export type HealthCheckState = 'ok' | 'degraded' | 'fail' | 'unknown'

export type RawHealthCheck = boolean | HealthCheckState | 'unreachable'

export type BuildMetadata = {
  app: string
  environment: string
  gitSha: string
  buildTimestamp: string
  artifactId: string
  releaseId: string
  appVersion: string
  timestamp: string
}

function toHealthCheckState(value: RawHealthCheck): HealthCheckState {
  if (typeof value === 'boolean') {
    return value ? 'ok' : 'fail'
  }

  if (value === 'ok' || value === 'degraded' || value === 'fail' || value === 'unknown') {
    return value
  }

  if (value === 'unreachable') {
    return 'fail'
  }

  return 'unknown'
}

export function normalizeHealthChecks(checks: Record<string, RawHealthCheck>): Record<string, HealthCheckState> {
  return Object.fromEntries(
    Object.entries(checks).map(([key, value]) => [key, toHealthCheckState(value)]),
  )
}

export function isReadyFromChecks(
  checks: Record<string, HealthCheckState>,
  requiredChecks: string[],
): boolean {
  return requiredChecks.every((name) => checks[name] === 'ok')
}

export function healthStatusFromChecks(checks: Record<string, HealthCheckState>): 'ok' | 'degraded' {
  const allOk = Object.values(checks).every((state) => state === 'ok')
  return allOk ? 'ok' : 'degraded'
}

export function getBuildMetadata(app: string): BuildMetadata {
  return {
    app,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ??
      process.env.APP_ENV ??
      process.env.NODE_ENV ??
      'unknown',
    // Priority: Vercel SHA → build-time baked GITHUB_SHA → runtime GITHUB_SHA → 'local'
    gitSha:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.GITHUB_SHA ??
      'local',
    buildTimestamp: process.env.BUILD_TIME ?? process.env.BUILD_TIMESTAMP ?? 'unknown',
    artifactId: process.env.ARTIFACT_ID ?? 'unknown',
    releaseId: process.env.RELEASE_ID ?? process.env.ARTIFACT_ID ?? 'unknown',
    appVersion: process.env.npm_package_version ?? '0.0.0',
    timestamp: new Date().toISOString(),
  }
}
