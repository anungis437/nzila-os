/**
 * Phase 0C.2R §6 Rung 1 — Route pre-warm probes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose
 * ─────────────────────────────────────────────────────────────────────────────
 * Next.js dev-mode compiles route bundles on-demand at first request. Under
 * Playwright load — where multiple projects hit multiple routes in parallel
 * within the first two minutes — those cold compiles compete for the event
 * loop and stall `/api/health` responses. That cascade is the observed root
 * cause of FSR-A (ensureServerReady 90s timeout, 34/51 failures in Run 6.1)
 * documented in `phase-0c2r-dev-mode-5-run-comparison.md`.
 *
 * This module warms the compile cache proactively AFTER the managed-server
 * handshake proves server identity and BEFORE Playwright starts. Probes are:
 *
 *   - SEQUENTIAL — never parallel. Parallel cold compiles are the disease,
 *     not the cure.
 *   - BEST-EFFORT — a failing probe logs a warning but does NOT abort the
 *     lifecycle. Pre-warm is a latency optimisation, not a correctness gate.
 *   - BOUNDED — every probe has a per-route timeout via AbortController, and
 *     the whole batch has a total budget. Once the budget is exceeded, the
 *     remaining routes are skipped and marked `budget-exceeded`.
 *
 * Non-negotiables preserved (from Phase 0C.2R §5.2):
 *   - No admin exclusion (all routes probed regardless of persona).
 *   - No baseline redefinition (this file only adds source; the §5.6 exit
 *     criteria remain as written).
 *   - No defect transfer (product/spec defects surfaced by §BR-8 remain
 *     open; pre-warm addresses infra dev-server compile only).
 *
 * All helpers are pure (fetch is injectable) so tests can exercise every
 * outcome without booting a real server.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * High-impact routes to pre-warm, ORDERED BY BLAST-RADIUS (most-hit first).
 *
 * Selection rationale (per §BR-8 batch forensics and §6 failure analysis):
 *   1-2. Locale homepages — hit by public, bilingual, a11y projects.
 *   3-5. Locale marketing pages — hit by bilingual + a11y (12/14 assertions).
 *   6.   /sign-in — first cold hit by security project at position 162/193.
 *   7.   Persona landing (member dashboard) — most-common assertRoleLanding.
 *   8.   Admin dashboard — 104-spec project; primary DNR cascade epicenter.
 *   9.   Continuity assessment start — RTP-8 (ocra-adaptive-flow 45s cold).
 *   10.  Feature-flags API — RTP-2 (ECONNRESET when compile queue saturated).
 *   11.  Managed-server health — cheap, but confirms handshake path warm.
 *   12.  Standard health — RTP-9 (governance apiRequest 20s cold).
 */
export const PREWARM_ROUTES: readonly string[] = Object.freeze([
  '/en-CA',
  '/fr-CA',
  '/en-CA/trust',
  '/en-CA/pricing',
  '/en-CA/story',
  '/sign-in',
  '/en-CA/dashboard',
  '/en-CA/admin',
  '/continuity-assessment/start',
  '/api/feature-flags?flag=pilot-mode',
  '/api/health/managed-server',
  '/api/health',
])

/** Per-route AbortController timeout. 30s matches §5 handshake ceiling. */
export const PREWARM_PER_ROUTE_TIMEOUT_MS = 30_000

/** Total budget across all probes. Must be ≤ step-8 remaining budget. */
export const PREWARM_TOTAL_BUDGET_MS = 120_000

/** Accepted status codes — any non-5xx counts as "compiled". */
const ACCEPTED_STATUSES: ReadonlySet<number> = new Set([
  200, 204, 301, 302, 303, 307, 308, 400, 401, 403, 404, 405,
])

// ─── Result types ────────────────────────────────────────────────────────────

/** Outcome of a single probe. */
export type PrewarmProbeOutcome =
  | 'ok'
  | 'accepted-non-2xx'
  | 'server-error'
  | 'timeout'
  | 'network-error'
  | 'budget-exceeded'
  | 'skipped'

export interface PrewarmProbeResult {
  route: string
  outcome: PrewarmProbeOutcome
  status?: number
  elapsedMs: number
  error?: string
}

export interface PrewarmSummary {
  probed: number
  ok: number
  acceptedNon2xx: number
  serverError: number
  timeout: number
  networkError: number
  budgetExceeded: number
  skipped: number
  totalElapsedMs: number
}

export interface PrewarmResult {
  summary: PrewarmSummary
  probes: readonly PrewarmProbeResult[]
}

// ─── Options ─────────────────────────────────────────────────────────────────

type Fetcher = (input: string, init?: { signal?: AbortSignal; method?: string; headers?: Record<string, string> }) => Promise<{ status: number }>

type ClockNow = () => number

export interface WarmRoutesOptions {
  baseUrl: string
  routes?: readonly string[]
  perRouteTimeoutMs?: number
  totalBudgetMs?: number
  fetchImpl?: Fetcher
  now?: ClockNow
  onProbe?: (result: PrewarmProbeResult) => void
}

// ─── Implementation ──────────────────────────────────────────────────────────

/** Trim trailing slashes so `joinUrl(baseUrl, route)` cannot double-slash. */
function normaliseBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function classifyStatus(status: number): PrewarmProbeOutcome {
  if (status >= 200 && status < 300) return 'ok'
  if (status >= 500) return 'server-error'
  if (ACCEPTED_STATUSES.has(status)) return 'accepted-non-2xx'
  return 'accepted-non-2xx'
}

function emptySummary(): PrewarmSummary {
  return {
    probed: 0,
    ok: 0,
    acceptedNon2xx: 0,
    serverError: 0,
    timeout: 0,
    networkError: 0,
    budgetExceeded: 0,
    skipped: 0,
    totalElapsedMs: 0,
  }
}

function tallySummary(probes: readonly PrewarmProbeResult[], totalElapsedMs: number): PrewarmSummary {
  const s = emptySummary()
  s.totalElapsedMs = totalElapsedMs
  for (const p of probes) {
    s.probed += 1
    switch (p.outcome) {
      case 'ok':
        s.ok += 1
        break
      case 'accepted-non-2xx':
        s.acceptedNon2xx += 1
        break
      case 'server-error':
        s.serverError += 1
        break
      case 'timeout':
        s.timeout += 1
        break
      case 'network-error':
        s.networkError += 1
        break
      case 'budget-exceeded':
        s.budgetExceeded += 1
        break
      case 'skipped':
        s.skipped += 1
        break
    }
  }
  return s
}

/**
 * Sequentially fetch each route with a per-route timeout and a total budget.
 * Never throws — every failure is captured in the returned {@link PrewarmProbeResult}.
 */
export async function warmRoutes(options: WarmRoutesOptions): Promise<PrewarmResult> {
  const routes = options.routes ?? PREWARM_ROUTES
  const perRouteTimeoutMs = options.perRouteTimeoutMs ?? PREWARM_PER_ROUTE_TIMEOUT_MS
  const totalBudgetMs = options.totalBudgetMs ?? PREWARM_TOTAL_BUDGET_MS
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init as RequestInit))
  const now = options.now ?? (() => performance.now())
  const base = normaliseBase(options.baseUrl)

  const batchStart = now()
  const probes: PrewarmProbeResult[] = []

  for (const route of routes) {
    const elapsedSoFar = now() - batchStart
    if (elapsedSoFar >= totalBudgetMs) {
      const result: PrewarmProbeResult = {
        route,
        outcome: 'budget-exceeded',
        elapsedMs: 0,
      }
      probes.push(result)
      options.onProbe?.(result)
      continue
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), perRouteTimeoutMs)
    const probeStart = now()
    let result: PrewarmProbeResult
    try {
      const response = await fetchImpl(`${base}${route}`, {
        signal: controller.signal,
        method: 'GET',
        headers: {
          // Distinctive UA so server logs can attribute pre-warm traffic.
          'user-agent': 'nzila-e2e-prewarm/1',
        },
      })
      const elapsedMs = now() - probeStart
      result = {
        route,
        outcome: classifyStatus(response.status),
        status: response.status,
        elapsedMs,
      }
    } catch (err) {
      const elapsedMs = now() - probeStart
      const isAbort = err instanceof Error && err.name === 'AbortError'
      result = {
        route,
        outcome: isAbort ? 'timeout' : 'network-error',
        elapsedMs,
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      clearTimeout(timeout)
    }
    probes.push(result)
    options.onProbe?.(result)
  }

  const totalElapsedMs = now() - batchStart
  return { summary: tallySummary(probes, totalElapsedMs), probes }
}
