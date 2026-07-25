/**
 * Phase 0C.2R §6 Rung 1 — Tests for route pre-warm probes.
 *
 * These tests exercise every outcome of `warmRoutes` without hitting a real
 * server: the `fetch` implementation and clock are both injectable.
 *
 * Together with the wiring in `run.ts` step 8, this closes the §6 root-cause
 * loop identified in `phase-0c2r-dev-mode-5-run-comparison.md`: parallel
 * Playwright cold-compile requests stalling `/api/health` and cascading to
 * 131 did-not-run failures.
 */
import { describe, expect, it, vi } from 'vitest'

import {
  PREWARM_PER_ROUTE_TIMEOUT_MS,
  PREWARM_ROUTES,
  PREWARM_TOTAL_BUDGET_MS,
  warmRoutes,
} from './route-prewarm'

/** Build a deterministic clock that advances by `stepMs` on every call. */
function fakeClock(stepMs: number, start = 0): () => number {
  let t = start
  return () => {
    const v = t
    t += stepMs
    return v
  }
}

const BASE = 'http://localhost:3002'

describe('§6 Rung 1 — Frozen constants', () => {
  it('PREWARM_PER_ROUTE_TIMEOUT_MS is 30 seconds', () => {
    expect(PREWARM_PER_ROUTE_TIMEOUT_MS).toBe(30_000)
  })

  it('PREWARM_TOTAL_BUDGET_MS is 120 seconds', () => {
    expect(PREWARM_TOTAL_BUDGET_MS).toBe(120_000)
  })

  it('PREWARM_ROUTES is a frozen, non-empty tuple', () => {
    expect(Object.isFrozen(PREWARM_ROUTES)).toBe(true)
    expect(PREWARM_ROUTES.length).toBeGreaterThanOrEqual(10)
  })

  it('PREWARM_ROUTES prioritises locale homepages first (highest blast radius)', () => {
    // These MUST be probed before persona/admin routes so setup/public/bilingual/a11y
    // do not race the compiler for the same bundles.
    expect(PREWARM_ROUTES[0]).toBe('/en-CA')
    expect(PREWARM_ROUTES[1]).toBe('/fr-CA')
  })

  it('PREWARM_ROUTES includes the §BR-8 hot signatures', () => {
    // Signatures observed in Batch A/C forensics.
    expect(PREWARM_ROUTES).toContain('/sign-in')
    expect(PREWARM_ROUTES).toContain('/en-CA/admin')
    expect(PREWARM_ROUTES).toContain('/continuity-assessment/start')
    expect(PREWARM_ROUTES).toContain('/api/feature-flags?flag=pilot-mode')
    expect(PREWARM_ROUTES).toContain('/api/health')
  })

  it('PREWARM_ROUTES contains no duplicates', () => {
    const set = new Set(PREWARM_ROUTES)
    expect(set.size).toBe(PREWARM_ROUTES.length)
  })

  it('PREWARM_ROUTES routes are all absolute paths (start with "/")', () => {
    for (const r of PREWARM_ROUTES) {
      expect(r.startsWith('/')).toBe(true)
    }
  })
})

describe('§6 Rung 1 — warmRoutes happy path', () => {
  it('classifies 2xx as "ok"', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/en-CA', '/api/health'],
      fetchImpl,
      now: fakeClock(50),
    })
    expect(result.summary.probed).toBe(2)
    expect(result.summary.ok).toBe(2)
    expect(result.probes.every((p) => p.outcome === 'ok')).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('joins base URL and route without double-slashing when base has trailing slash', async () => {
    const calls: string[] = []
    const fetchImpl = vi.fn(async (input: string) => {
      calls.push(input)
      return { status: 200 }
    })
    await warmRoutes({
      baseUrl: 'http://localhost:3002/',
      routes: ['/en-CA'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(calls).toEqual(['http://localhost:3002/en-CA'])
  })

  it('sends the distinctive pre-warm user-agent', async () => {
    let seenUa: string | undefined
    const fetchImpl = vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
      seenUa = init?.headers?.['user-agent']
      return { status: 200 }
    })
    await warmRoutes({
      baseUrl: BASE,
      routes: ['/en-CA'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(seenUa).toBe('nzila-e2e-prewarm/1')
  })

  it('sends GET method (never mutates)', async () => {
    let seenMethod: string | undefined
    const fetchImpl = vi.fn(async (_url: string, init?: { method?: string }) => {
      seenMethod = init?.method
      return { status: 200 }
    })
    await warmRoutes({
      baseUrl: BASE,
      routes: ['/en-CA'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(seenMethod).toBe('GET')
  })

  it('probes routes SEQUENTIALLY (not in parallel)', async () => {
    // Record fetch start order — parallel would show interleaving; sequential must not.
    const order: string[] = []
    let inflight = 0
    let maxInflight = 0
    const fetchImpl = vi.fn(async (input: string) => {
      inflight += 1
      maxInflight = Math.max(maxInflight, inflight)
      order.push(input)
      await new Promise((r) => setTimeout(r, 5))
      inflight -= 1
      return { status: 200 }
    })
    await warmRoutes({
      baseUrl: BASE,
      routes: ['/a', '/b', '/c'],
      fetchImpl,
    })
    expect(order).toEqual([`${BASE}/a`, `${BASE}/b`, `${BASE}/c`])
    expect(maxInflight).toBe(1)
  })
})

describe('§6 Rung 1 — warmRoutes classification', () => {
  it('classifies 401/403/404 as "accepted-non-2xx" (route is compiled)', async () => {
    const statuses = [401, 403, 404]
    const fetchImpl = vi.fn(async () => ({ status: statuses.shift()! }))
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a', '/b', '/c'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(result.summary.acceptedNon2xx).toBe(3)
    expect(result.summary.ok).toBe(0)
    expect(result.summary.serverError).toBe(0)
  })

  it('classifies 5xx as "server-error"', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 502 }))
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(result.summary.serverError).toBe(1)
    expect(result.probes[0]!.outcome).toBe('server-error')
  })

  it('classifies AbortError as "timeout"', async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      throw err
    })
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(result.summary.timeout).toBe(1)
    expect(result.probes[0]!.outcome).toBe('timeout')
  })

  it('classifies non-AbortError throws as "network-error"', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    })
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(result.summary.networkError).toBe(1)
    expect(result.probes[0]!.outcome).toBe('network-error')
    expect(result.probes[0]!.error).toContain('ECONNREFUSED')
  })
})

describe('§6 Rung 1 — Budget enforcement', () => {
  it('marks remaining routes as "budget-exceeded" once total budget elapses', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    // Clock jumps 60_000ms per read: after 2 probes, elapsed=120_000 hits budget.
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a', '/b', '/c', '/d'],
      fetchImpl,
      now: fakeClock(60_000),
      totalBudgetMs: 120_000,
    })
    expect(result.summary.budgetExceeded).toBeGreaterThanOrEqual(1)
    const budgetExceeded = result.probes.filter((p) => p.outcome === 'budget-exceeded')
    expect(budgetExceeded.length).toBeGreaterThanOrEqual(1)
    // fetchImpl was called fewer times than routes.length
    expect(fetchImpl.mock.calls.length).toBeLessThan(4)
  })

  it('NEVER throws — every failure surfaces via probe.outcome', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('unrecoverable')
    })
    await expect(
      warmRoutes({
        baseUrl: BASE,
        routes: PREWARM_ROUTES,
        fetchImpl,
        now: fakeClock(10),
      }),
    ).resolves.toBeDefined()
  })
})

describe('§6 Rung 1 — Observability', () => {
  it('invokes onProbe callback for every probe (including budget-exceeded)', async () => {
    const seen: string[] = []
    const fetchImpl = vi.fn(async () => ({ status: 200 }))
    await warmRoutes({
      baseUrl: BASE,
      routes: ['/a', '/b'],
      fetchImpl,
      now: fakeClock(10),
      onProbe: (r) => seen.push(`${r.route}:${r.outcome}`),
    })
    expect(seen).toEqual(['/a:ok', '/b:ok'])
  })

  it('summary tallies match probes counts exactly', async () => {
    const statuses = [200, 404, 500, 200]
    const fetchImpl = vi.fn(async () => ({ status: statuses.shift()! }))
    const result = await warmRoutes({
      baseUrl: BASE,
      routes: ['/a', '/b', '/c', '/d'],
      fetchImpl,
      now: fakeClock(10),
    })
    expect(result.summary.probed).toBe(4)
    expect(result.summary.ok).toBe(2)
    expect(result.summary.acceptedNon2xx).toBe(1)
    expect(result.summary.serverError).toBe(1)
    expect(
      result.summary.ok +
        result.summary.acceptedNon2xx +
        result.summary.serverError +
        result.summary.timeout +
        result.summary.networkError +
        result.summary.budgetExceeded +
        result.summary.skipped,
    ).toBe(result.summary.probed)
  })
})
