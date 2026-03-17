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

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

interface HealthPayload {
  service: string
  status: string
  version: string
  uptime: number
  db_connection: boolean
  queue_status: string
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
          db: health?.db_connection ?? false,
          queue: health?.queue_status ?? 'unknown',
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
