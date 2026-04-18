/**
 * Zonga — Prometheus-compatible metrics endpoint.
 *
 * Exposes the os-core MetricsRegistry snapshot in a format
 * that can be scraped by Azure Monitor Agent / OTEL Collector.
 *
 * Access: GET /api/metrics
 * - Protected by a bearer token (METRICS_BEARER_TOKEN env var)
 * - Fail-closed outside dev/test when token is missing
 * - Response cached for 10s to limit CPU overhead from frequent scrapes
 */
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { metrics } from '@nzila/os-core/telemetry'
import { getRateLimitStore } from '@nzila/os-core/rateLimit/store'
import { enqueueJob } from '@/lib/queue-jobs'
import { isDevOrTestRuntime, requireEnvVar } from '@/lib/runtime-env'
import { resolveCommercialDbOrgId } from '@/lib/commercial-context'

export const dynamic = 'force-dynamic'

// ── Snapshot cache (10s TTL) ────────────────────────────────────────────
let cachedBody: string | null = null
let cachedAt = 0
const CACHE_TTL_MS = 10_000

/**
 * Render counters and histograms in Prometheus text exposition format.
 */
function toPrometheusText(snapshot: ReturnType<typeof metrics.getSnapshot>): string {
  const lines: string[] = []

  for (const c of snapshot.counters) {
    const labels = Object.entries(c.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    lines.push(`${c.name}{${labels}} ${c.value}`)
  }

  for (const h of snapshot.histograms) {
    const labels = Object.entries(h.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    for (let i = 0; i < h.buckets.length; i++) {
      lines.push(`${h.name}_bucket{${labels},le="${h.buckets[i]}"} ${h.counts[i]}`)
    }
    lines.push(`${h.name}_bucket{${labels},le="+Inf"} ${h.count}`)
    lines.push(`${h.name}_sum{${labels}} ${h.sum}`)
    lines.push(`${h.name}_count{${labels}} ${h.count}`)
  }

  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  const orgId = resolveCommercialDbOrgId(process.env.PLATFORM_ORG_ID)

  // Bearer token auth — required when METRICS_BEARER_TOKEN is set.
  // Uses timingSafeEqual() to prevent timing-based token enumeration.
  const token = process.env.METRICS_BEARER_TOKEN
  if (!token && !isDevOrTestRuntime()) {
    // Fail-closed outside development/test.
    requireEnvVar('METRICS_BEARER_TOKEN')
  }

  const auth = request.headers.get('authorization') ?? ''
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const limiter = await getRateLimitStore()
  const rateLimit = await limiter.hit(`metrics:${ip}`, 60_000, 60)
  if (!rateLimit.allowed) {
    await enqueueJob({
      orgId,
      queue: 'security-audit',
      jobType: 'metrics.access.denied.rate_limit',
      payload: { ip, path: '/api/metrics', at: new Date().toISOString() },
      idempotencyKey: `metrics-rate:${ip}:${new Date().toISOString().slice(0, 16)}`,
      maxRetries: 1,
    })
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  if (token) {
    const expected = `Bearer ${token}`
    const authBytes = Buffer.from(auth)
    const expectedBytes = Buffer.from(expected)
    const valid =
      authBytes.length === expectedBytes.length &&
      timingSafeEqual(authBytes, expectedBytes)
    if (!valid) {
      await enqueueJob({
        orgId,
        queue: 'security-audit',
        jobType: 'metrics.access.denied.auth',
        payload: { ip, path: '/api/metrics', at: new Date().toISOString() },
        idempotencyKey: `metrics-auth:${ip}:${new Date().toISOString().slice(0, 16)}`,
        maxRetries: 1,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  await enqueueJob({
    orgId,
    queue: 'security-audit',
    jobType: 'metrics.access.allowed',
    payload: { ip, path: '/api/metrics', at: new Date().toISOString() },
    idempotencyKey: `metrics-ok:${ip}:${new Date().toISOString().slice(0, 16)}`,
    maxRetries: 1,
  })

  const now = Date.now()
  if (!cachedBody || now - cachedAt > CACHE_TTL_MS) {
    const snapshot = metrics.getSnapshot()
    cachedBody = toPrometheusText(snapshot)
    cachedAt = now
  }

  return new NextResponse(cachedBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'public, max-age=10',
    },
  })
}
