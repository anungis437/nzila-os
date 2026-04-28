/**
 * Live integration adapters — Phase 2 source-of-truth feeds.
 *
 * Fetches health + version + (where exposed) lightweight metrics from peer
 * apps so /integrations shows real status instead of static deep-links.
 *
 * Discipline:
 *  - Hard 1500 ms timeout per call. Cockpit pages must not block on a slow
 *    peer app — `consolePulse()` falls back to `{ ok:false, reason:'timeout' }`.
 *  - Server-only. Never reaches the browser.
 *  - Response cached per request via `react.cache` so the same call inside a
 *    single render pass hits the network once.
 *  - No metric fabrication. If the peer doesn't expose a number, it's null.
 */
import 'server-only'
import { cache } from 'react'

const TIMEOUT_MS = 1500

export type PeerStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface PeerPulse {
  app: 'console' | 'platform-admin' | 'control-plane'
  url: string | null
  status: PeerStatus
  latencyMs: number | null
  version?: string | null
  reason?: string
  raw?: unknown
}

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Internal aggregation traffic — never cached at HTTP layer; React
      // `cache()` handles per-request memoization.
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function pulse(
  app: PeerPulse['app'],
  baseUrl: string | undefined | null,
): Promise<PeerPulse> {
  if (!baseUrl) {
    return { app, url: null, status: 'unknown', latencyMs: null, reason: 'env-not-set' }
  }
  const url = baseUrl.replace(/\/+$/, '')
  const started = performance.now()
  const health = await safeFetchJson<{ status?: string; ok?: boolean }>(`${url}/api/health`)
  const latencyMs = Math.round(performance.now() - started)
  if (!health) {
    return { app, url, status: 'down', latencyMs, reason: 'no-response' }
  }
  const ok = health.ok === true || health.status === 'ok' || health.status === 'healthy'
  const version = await safeFetchJson<{ version?: string }>(`${url}/api/version`)
  return {
    app,
    url,
    status: ok ? 'healthy' : 'degraded',
    latencyMs,
    version: version?.version ?? null,
    raw: health,
  }
}

export const consolePulse = cache(async (): Promise<PeerPulse> =>
  pulse('console', process.env.NEXT_PUBLIC_CONSOLE_URL),
)

export const platformAdminPulse = cache(async (): Promise<PeerPulse> =>
  pulse('platform-admin', process.env.NEXT_PUBLIC_PLATFORM_ADMIN_URL),
)

export const controlPlanePulse = cache(async (): Promise<PeerPulse> =>
  pulse('control-plane', process.env.NEXT_PUBLIC_CONTROL_PLANE_URL),
)

export const allPeerPulses = cache(async (): Promise<readonly PeerPulse[]> => {
  return Promise.all([consolePulse(), platformAdminPulse(), controlPlanePulse()])
})
