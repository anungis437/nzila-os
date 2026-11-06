/**
 * Control Plane → Union Eyes telemetry fan-in.
 *
 * The credentials are intentionally non-interchangeable:
 * - UE_METRICS_SERVICE_KEY: metrics:platform_operational:read
 * - QUEUE_STATUS_SERVICE_KEY: existing queue status capability
 * - AI_SERVICE_KEY: not accepted by either Control Plane telemetry consumer.
 * Missing credentials result in unavailable data, not a privileged fallback.
 */
import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

async function fetchJson<T>(url: string, key?: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {}
    if (key) headers['x-service-key'] = key
    const res = await fetch(url, { cache: 'no-store', headers })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

interface HealthPayload {
  app: string
  status: string
  version: string
  uptime: number
  checks: { db: string; queue: string }
}

interface MetricsPayload {
  sla_violations: number | null
  workflow_transition_rate: number | null
  queue_depth: number
  error_rate: number | null
}

interface QueuePayload {
  queue: {
    pending: number
    active: number
    failed: number
    retry_count: number
  }
}

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)

    const baseUrl = process.env.UNION_EYES_URL
    if (!baseUrl) {
      return NextResponse.json({
        ok: false,
        error: { code: 'UNION_EYES_URL_NOT_CONFIGURED', message: 'UNION_EYES_URL is required to collect union-eyes telemetry' },
      }, { status: 500 })
    }

    const metricsKey = process.env.UE_METRICS_SERVICE_KEY
    const queueKey = process.env.QUEUE_STATUS_SERVICE_KEY
    const aiKey = process.env.AI_SERVICE_KEY
    const distinct = (key: string | undefined, other: string | undefined) =>
      !!key && key.length >= 32 && key !== other

    // Neither endpoint may receive a reused AI key or the other's credential.
    const validMetricsKey = distinct(metricsKey, queueKey) && distinct(metricsKey, aiKey)
    const validQueueKey = distinct(queueKey, metricsKey) && distinct(queueKey, aiKey)

    const [health, metrics, queue] = await Promise.all([
      fetchJson<HealthPayload>(`${baseUrl}/api/health`),
      validMetricsKey ? fetchJson<MetricsPayload>(`${baseUrl}/api/metrics/operational`, metricsKey) : Promise.resolve(null),
      validQueueKey ? fetchJson<QueuePayload>(`${baseUrl}/api/union-eyes/queue-status`, queueKey) : Promise.resolve(null),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        module: 'union-eyes',
        health: {
          status: health?.status ?? 'unreachable',
          version: health?.version ?? 'unknown',
          uptime: health?.uptime ?? 0,
          db: health?.checks?.db === 'ok',
          queue: health?.checks?.queue ?? 'unknown',
        },
        sla: {
          violations: metrics?.sla_violations ?? null,
          transition_rate_24h: metrics?.workflow_transition_rate ?? null,
          error_rate: metrics?.error_rate ?? null,
        },
        queue: {
          pending: queue?.queue?.pending ?? null,
          active: queue?.queue?.active ?? null,
          failed: queue?.queue?.failed ?? null,
          retry_count: queue?.queue?.retry_count ?? null,
        },
        fetched_at: new Date().toISOString(),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleAuthError(error)
  }
}
