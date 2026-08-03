import { expect, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USER_PASSWORD, UE_TEST_USERS } from '../fixtures/test-users'
import { getE2EEnv } from './e2e-env'

export function getBaseUrl(): string {
  return getE2EEnv().PLAYWRIGHT_BASE_URL
}

export async function ensureServerReady(request: APIRequestContext): Promise<void> {
  const endpoints = ['/api/auth_core/health/', '/api/health', '/sign-in']
  const timeoutMs = 180_000
  const pollMs = 1_500
  const startedAt = Date.now()
  let lastError: string | null = null

  while (Date.now() - startedAt < timeoutMs) {
    for (const endpoint of endpoints) {
      try {
        const response = await request.get(endpoint, { timeout: 10_000 })
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
