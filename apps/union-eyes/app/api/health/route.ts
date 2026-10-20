// Observability: @nzila/os-core/health — canonical health contract
import { NextResponse } from 'next/server'
import {
  buildRuntimeHealthResponse,
  getBuildMetadata,
  healthStatusFromChecks,
  normalizeHealthChecks,
  type HealthCheckState,
  type RuntimeHealthCheck,
} from '@nzila/os-core/health'
import { createLogger } from '@nzila/os-core/telemetry'
import {
  CATALOG_ADMISSION_PUBLIC_ERROR,
  evaluateCatalogAdmission,
} from '@/lib/operations/catalog-admission'

const APP = 'union-eyes'
const logger = createLogger('union-eyes.health')

async function checkCatalogAuthority(): Promise<{ state: HealthCheckState; ms: number; error?: string; note?: string }> {
  const start = Date.now()
  try {
    const report = await evaluateCatalogAdmission()
    if (!report.ok) {
      logger.error('catalog authority admission failed', {
        event: 'catalog_authority_admission_failed',
        applicationReady: false,
        privilegesUnchanged: true,
        violationCount: report.violations.length,
        violations: report.violations,
      })
      return {
        state: 'fail',
        ms: Date.now() - start,
        error: CATALOG_ADMISSION_PUBLIC_ERROR,
        note: 'applicationReady=false',
      }
    }
    return {
      state: 'ok',
      ms: Date.now() - start,
      note: 'applicationReady=false',
    }
  } catch (err) {
    logger.error('catalog authority admission failed', {
      event: 'catalog_authority_admission_failed',
      applicationReady: false,
      privilegesUnchanged: true,
      error: err instanceof Error ? err.message : 'catalog admission failed',
    })
    return {
      state: 'fail',
      ms: Date.now() - start,
      error: CATALOG_ADMISSION_PUBLIC_ERROR,
      note: 'applicationReady=false',
    }
  }
}

async function checkDb(): Promise<{ state: HealthCheckState; ms: number; error?: string }> {
  const start = Date.now()
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    // Cast needed: packages/db pins drizzle-orm ^0.39 while app uses ^0.45
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.execute(sql`SELECT 1` as any)
    return { state: 'ok', ms: Date.now() - start }
  } catch (err) {
    return {
      state: 'fail',
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkAuth(): Promise<HealthCheckState> {
  // Auth/session: validate AUTH_SECRET present (full connectivity check too expensive for a probe)
  // Primary: PG-backed password/session auth (nzila_session cookie)
  // Secondary: Entra External ID / NextAuth (SSO fallback)
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET)
  return hasAuthSecret ? 'ok' : 'degraded'
}

async function checkRedis(): Promise<{ state: HealthCheckState; ms?: number; note?: string }> {
  const hasRedis =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) ||
    Boolean(process.env.KV_REST_API_URL) ||
    Boolean(process.env.REDIS_URL)
  if (!hasRedis) return { state: 'ok', note: 'Redis not configured — optional for this deployment' }

  try {
    const start = Date.now()
    const url = (
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      ''
    ).replace(/\/$/, '')
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ''
    if (!url || !token) return { state: 'degraded', note: 'Redis URL or token missing' }

    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
      ? { state: 'ok', ms: Date.now() - start }
      : { state: 'degraded', note: `ping returned ${res.status}`, ms: Date.now() - start }
  } catch (err) {
    return { state: 'degraded', note: err instanceof Error ? err.message : 'unreachable' }
  }
}

async function checkBackend(): Promise<{ state: HealthCheckState; ms?: number; note?: string }> {
  const mode = (process.env.NZILA_MODE ?? process.env.UE_ENVIRONMENT ?? '').toLowerCase()
  const deploymentType = (process.env.NZILA_DEPLOYMENT_TYPE ?? '').toLowerCase()
  const featureProfile = (process.env.FEATURE_PROFILE ?? '').toLowerCase()

  // Operational package: no customer-branded demo profile is honoured. The
  // sibling @nzila/union-eyes-demo package owns the demo runtime entirely.
  const isDemoRuntime =
    mode === 'demo' ||
    deploymentType.includes('demo') ||
    featureProfile.includes('demo')

  if (isDemoRuntime) {
    const reason = deploymentType || mode || featureProfile || 'demo-runtime'
    return { state: 'ok', note: `Django probe skipped for demo runtime (${reason})` }
  }

  const djangoUrl = process.env.DJANGO_API_URL ?? process.env.NEXT_PUBLIC_DJANGO_API_URL ?? ''
  if (!djangoUrl) return { state: 'ok', note: 'Django backend not configured — optional' }

  try {
    const start = Date.now()
    const base = djangoUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/api/auth_core/health/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
      ? { state: 'ok', ms: Date.now() - start }
      : { state: 'degraded', ms: Date.now() - start, note: `returned ${res.status}` }
  } catch {
    return { state: 'degraded', note: 'unreachable' }
  }
}

export async function GET() {
  const [dbResult, authResult, redisResult, backendResult, catalogResult] = await Promise.allSettled([
    checkDb(),
    checkAuth(),
    checkRedis(),
    checkBackend(),
    checkCatalogAuthority(),
  ])

  const db: { state: HealthCheckState; ms: number; error?: string } =
    dbResult.status === 'fulfilled'
      ? dbResult.value
      : { state: 'fail', ms: 0, error: 'probe failed' }
  const auth: HealthCheckState =
    authResult.status === 'fulfilled' ? authResult.value : 'degraded'
  const redis: { state: HealthCheckState; ms?: number; note?: string } =
    redisResult.status === 'fulfilled'
      ? redisResult.value
      : { state: 'degraded', note: 'probe failed' }
  const backend: { state: HealthCheckState; ms?: number; note?: string } =
    backendResult.status === 'fulfilled'
      ? backendResult.value
      : { state: 'degraded', note: 'probe failed' }
  const catalog: { state: HealthCheckState; ms: number; error?: string; note?: string } =
    catalogResult.status === 'fulfilled'
      ? catalogResult.value
      : { state: 'fail', ms: 0, error: CATALOG_ADMISSION_PUBLIC_ERROR, note: 'applicationReady=false' }

  // Normalize raw states via os-core primitives (cross-app health contract)
  const normalized = normalizeHealthChecks({
    process: 'ok',
    database: db.state,
    auth,
    redis: redis.state,
    backend: backend.state,
  })
  const _simpleStatus = healthStatusFromChecks(normalized)

  // Build full RuntimeHealthCheck map with critical flags and rich metadata
  const checks: Record<string, RuntimeHealthCheck> = {
    process: { status: 'ok' },
    database: {
      status: normalized.database,
      critical: true,
      ms: db.ms,
      ...(db.error ? { error: db.error } : {}),
    },
    auth: { status: normalized.auth, critical: true },
    redis: {
      status: normalized.redis,
      ...(redis.ms !== undefined ? { ms: redis.ms } : {}),
      ...(redis.note ? { note: redis.note } : {}),
    },
    backend: {
      status: normalized.backend,
      ...(backend.ms !== undefined ? { ms: backend.ms } : {}),
      ...(backend.note ? { note: backend.note } : {}),
    },
    catalogAuthority: {
      status: catalog.state,
      critical: true,
      ms: catalog.ms,
      ...(catalog.error ? { error: catalog.error } : {}),
      ...(catalog.note ? { note: catalog.note } : {}),
    },
  }

  // Enrich payload with build metadata and build full runtime response
  const buildMeta = getBuildMetadata(APP)
  const payload = buildRuntimeHealthResponse({
    app: APP,
    checks,
    version: buildMeta.appVersion,
    environment: buildMeta.environment,
  })

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 })
}

