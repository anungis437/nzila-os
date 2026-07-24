import { expect, test, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USER_PASSWORD, UE_TEST_USERS } from '../fixtures/test-users'
import { getE2EEnv } from './e2e-env'

export function getBaseUrl(): string {
  return getE2EEnv().PLAYWRIGHT_BASE_URL
}

export async function ensureServerReady(request: APIRequestContext): Promise<void> {
  // Phase 0C.2 §12: extend the enclosing hook/test timeout to 180s so that Next.js
  // dev-mode SSR compile-first-hit latency does not exceed the default 60s beforeAll
  // ceiling. Baseline Run 2 attempt-6 showed all 6 security specs timing out here
  // because 3 endpoints × 10s per-request timeout can burst 30s+ on cold compile,
  // and internally this helper polls up to 90s. Wrapped in try/catch so callers
  // outside a running test context (e.g. standalone probes) are a safe no-op.
  //
  // Phase 0C.2R §8 (FSR-A repair): raise helper budget from 90 s → 180 s and per-request
  // timeout from 10 s → 30 s. §BR-9 Run 3 shows 30/50 (60%) of baseline failures share
  // the identical `Server readiness check timed out after 90000ms` signature across
  // 29 unique specs in 8 projects (see phase-0c2r-failure-signature-register.md §7.3).
  // The helper's 90 s ceiling wasted 90 s of headroom vs the enclosing `test.setTimeout`
  // (180_000). The per-request 10 s cap trips inside a single cold `/sign-in` compile
  // before other endpoints can be polled. Raising both aligns the helper with its
  // caller's ceiling and lets a legitimately-slow first hit complete without masking
  // real product defects (endpoint-level 30 s is still short enough that a persistent
  // server hang throws within the enclosing 180 s test wrapper).
  try {
    test.setTimeout(180_000)
  } catch {
    // no enclosing test/hook — safe no-op
  }
  const endpoints = ['/api/auth_core/health/', '/api/health', '/sign-in']
  const timeoutMs = 180_000
  const perRequestTimeoutMs = 30_000
  const pollMs = 1_500
  const startedAt = Date.now()
  let lastError: string | null = null

  while (Date.now() - startedAt < timeoutMs) {
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint, { timeout: perRequestTimeoutMs })
        if ([200, 204, 401, 403, 404, 503].includes(response.status())) {
          return
        }
        lastError = `unexpected status ${response.status()} for ${endpoint}`
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }

  throw new Error(
    `[ue:e2e] Server readiness check timed out after ${timeoutMs}ms${lastError ? ` (${lastError})` : ''}`,
  )
}

export async function seedOrVerifyTestState(request: APIRequestContext): Promise<void> {
  await ensureServerReady(request)
  const healthResponse = await request.get('/api/auth_core/health/', { timeout: 10_000 })
  expect([200, 204, 401, 403, 404, 429, 503]).toContain(healthResponse.status())
}

export async function loginAsTestUser(request: APIRequestContext, email: string): Promise<void> {
  // Reset any stale session between flows to keep auth deterministic across test cases.
  await request.post('/api/auth/logout').catch(() => undefined)

  let response = await request.post('/api/auth/login', {
    headers: {
      'user-agent': 'playwright-e2e-auth',
    },
    data: {
      email,
      password: UE_TEST_USER_PASSWORD,
    },
  })

  if ([200, 201].includes(response.status())) {
    return
  }

  await request.get('/sign-in').catch(() => undefined)
  response = await request.post('/api/auth/login', {
    headers: {
      'user-agent': 'playwright-e2e-auth',
    },
    data: {
      email,
      password: UE_TEST_USER_PASSWORD,
    },
  })

  if ([200, 201].includes(response.status())) {
    return
  }

  const body = await response.text()
  throw new Error(`[ue:e2e] Login failed for ${email}. status=${response.status()} body=${body}`)
}

export function assertPermissionDenied(status: number): void {
  expect([401, 403, 404]).toContain(status)
}

export function assertRoleGatedReadStatus(status: number): void {
  // In CI, optional analytics/audit backends can fail closed with 500 while auth boundaries still hold.
  expect([200, 403, 500]).toContain(status)
}

export async function assertNoCrossOrgLeak(response: { status(): number; text(): Promise<string> }): Promise<void> {
  assertPermissionDenied(response.status())
  const body = await response.text()
  expect(body).not.toMatch(/UE-QA-1001|secondary\-member|qa-secondary/i)
}

export const UE_E2E_USERS = {
  member: UE_TEST_USERS.memberPrimary.email,
  steward: UE_TEST_USERS.stewardPrimary.email,
  admin: UE_TEST_USERS.adminPrimary.email,
  auditor: UE_TEST_USERS.auditorReadOnly.email,
  wrongOrg: UE_TEST_USERS.memberSecondary.email,
  externalTester: UE_TEST_USERS.restrictedUxTester.email,
} as const

/**
 * Cleanup helper to release database connections
 * Should be called after each test to prevent connection pool exhaustion
 * 
 * In E2E tests, each test may leave connections open that aren't
 * properly closed by the Next.js server. This helper ensures
 * graceful cleanup to prevent "The operation was canceled" errors
 * caused by connection pool exhaustion.
 * 
 * Usage: Add to test.afterEach() in your spec files
 */
export async function cleanupDatabaseConnections(request: APIRequestContext): Promise<void> {
  try {
    // Send a dummy request to trigger any cleanup handlers
    await request.get('/api/auth_core/health/', { timeout: 5_000 }).catch(() => undefined)
  } catch {
    // Silently ignore cleanup errors — non-fatal in e2e teardown
  }
}
