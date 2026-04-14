/**
 * Zonga — Prometheus-compatible metrics endpoint.
 *
 * Exposes the os-core MetricsRegistry snapshot in a format
 * that can be scraped by Azure Monitor Agent / OTEL Collector.
 *
 * Access: GET /api/metrics
 * - Protected by a bearer token (METRICS_BEARER_TOKEN env var)
 * - Falls back to open access if no token configured (dev/test)
 * - Response cached for 10s to limit CPU overhead from frequent scrapes
 */
import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { metrics } from '@nzila/os-core/telemetry'

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
  // Bearer token auth — required when METRICS_BEARER_TOKEN is set.
  // Uses timingSafeEqual() to prevent timing-based token enumeration.
  const token = process.env.METRICS_BEARER_TOKEN
  if (token) {
    const auth = request.headers.get('authorization') ?? ''
    const expected = `Bearer ${token}`
    const authBytes = Buffer.from(auth)
    const expectedBytes = Buffer.from(expected)
    const valid =
      authBytes.length === expectedBytes.length &&
      timingSafeEqual(authBytes, expectedBytes)
    if (!valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

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
