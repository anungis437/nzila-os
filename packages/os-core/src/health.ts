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

/**
 * Runtime health contract — additive, used by app `/health` endpoints to emit a
 * stable, machine-checkable payload. Critical-aware: a non-critical degraded
 * check yields HTTP 200 with overall status `'degraded'`, while a failing
 * critical check yields HTTP 503 with `'failing'`.
 *
 * `'not_instrumented'` is reserved for apps that have not yet implemented real
 * probes — surface it honestly rather than reporting a fake `'healthy'`.
 */
export type RuntimeHealthStatus = 'healthy' | 'degraded' | 'failing' | 'not_instrumented'

export type RuntimeHealthCheck = {
  status: HealthCheckState
  /** When true, a non-`'ok'` state forces overall `'failing'`. Defaults to false. */
  critical?: boolean
  ms?: number
  error?: string
  note?: string
}

export type RuntimeHealthResponse = {
  ok: boolean
  status: RuntimeHealthStatus
  app: string
  environment: string
  timestamp: string
  version: string
  checks: Record<string, RuntimeHealthCheck>
  /** Optional: state of the configured custom domain, if the app has one. */
  customDomainStatus?: RuntimeHealthStatus
  /** Optional: state reachable via the platform fallback ingress hostname. */
  fallbackRuntimeStatus?: RuntimeHealthStatus
  /** Optional: explicit reason if status is `'not_instrumented'`. */
  reason?: string
}

export type BuildRuntimeHealthInput = {
  app: string
  checks: Record<string, RuntimeHealthCheck>
  /**
   * If true, force `'not_instrumented'` regardless of checks. Use for apps that
   * have not yet implemented any real probe.
   */
  notInstrumented?: boolean
  reason?: string
  customDomainStatus?: RuntimeHealthStatus
  fallbackRuntimeStatus?: RuntimeHealthStatus
  /** Override version (defaults to `process.env.npm_package_version`). */
  version?: string
  /** Override environment label. */
  environment?: string
  /** Override timestamp (mainly for tests). */
  timestamp?: string
}

/**
 * Compute overall runtime status from checks (critical-aware):
 *   - any critical check `!== 'ok'` ⇒ `'failing'`
 *   - any non-critical check `=== 'fail'` ⇒ `'failing'`
 *   - any check `=== 'degraded' | 'unknown'` ⇒ `'degraded'`
 *   - all `'ok'` ⇒ `'healthy'`
 */
export function runtimeStatusFromChecks(
  checks: Record<string, RuntimeHealthCheck>,
): RuntimeHealthStatus {
  const entries = Object.values(checks)
  if (entries.length === 0) return 'not_instrumented'

  let degraded = false
  for (const check of entries) {
    if (check.critical && check.status !== 'ok') return 'failing'
    if (check.status === 'fail') return 'failing'
    if (check.status === 'degraded' || check.status === 'unknown') degraded = true
  }
  return degraded ? 'degraded' : 'healthy'
}

/**
 * Build a stable runtime health payload. `ok` is true unless overall status is
 * `'failing'` — callers should map that to HTTP 503; everything else is HTTP 200
 * (degraded and not_instrumented are operationally informative, not outages).
 */
export function buildRuntimeHealthResponse(
  input: BuildRuntimeHealthInput,
): RuntimeHealthResponse {
  const status: RuntimeHealthStatus = input.notInstrumented
    ? 'not_instrumented'
    : runtimeStatusFromChecks(input.checks)

  return {
    ok: status !== 'failing',
    status,
    app: input.app,
    environment:
      input.environment ??
      process.env.NEXT_PUBLIC_APP_ENV ??
      process.env.APP_ENV ??
      process.env.NODE_ENV ??
      'unknown',
    timestamp: input.timestamp ?? new Date().toISOString(),
    version: input.version ?? process.env.npm_package_version ?? '0.0.0',
    checks: input.checks,
    ...(input.customDomainStatus ? { customDomainStatus: input.customDomainStatus } : {}),
    ...(input.fallbackRuntimeStatus ? { fallbackRuntimeStatus: input.fallbackRuntimeStatus } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  }
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
