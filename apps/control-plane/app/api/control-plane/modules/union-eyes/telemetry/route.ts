/**
 * GET /api/control-plane/modules/union-eyes/telemetry
 *
 * Aggregates union-eyes telemetry for the control-plane dashboard:
 * - EU health status
 * - SLA breach summary
 * - Queue backlog
 *
 * Fetches live data from the union-eyes service endpoints.
 */
import { NextResponse } from 'next/server'
import { requireApiAuth, handleAuthError } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

const EU_BASE_URL =
  process.env.UNION_EYES_URL || 'http://localhost:3003'

// Shared when calling union-eyes internal endpoints (s2s auth)
const EU_SERVICE_KEY = process.env.AI_SERVICE_KEY ?? ''

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const headers: Record<string, string> = {}
    if (EU_SERVICE_KEY) headers['x-service-key'] = EU_SERVICE_KEY
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
  checks: {
    db: string       // 'ok' | 'fail'
    queue: string    // 'ok' | 'degraded' | 'unreachable'
  }
}

interface MetricsPayload {
  sla_violations: number
  workflow_transition_rate: number
  queue_depth: number
  error_rate: number
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

    const [health, metrics, queue] = await Promise.all([
      fetchJson<HealthPayload>(`${EU_BASE_URL}/api/health`),
      fetchJson<MetricsPayload>(`${EU_BASE_URL}/api/metrics/operational`),
      fetchJson<QueuePayload>(`${EU_BASE_URL}/api/union-eyes/queue-status`),
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
    })
  } catch (error) {
    return handleAuthError(error)
  }
}
