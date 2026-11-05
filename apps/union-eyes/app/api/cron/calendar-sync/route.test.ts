import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  statement: vi.fn(),
  withSystemContext: vi.fn(),
  withRLSContext: vi.fn(),
}))

vi.mock('@/lib/api-auth-guard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-auth-guard')>()),
  getCurrentUser: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  createRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))
vi.mock('@/db/db', () => ({
  db: { select: mocks.statement, insert: mocks.statement, update: mocks.statement, delete: mocks.statement, execute: mocks.statement },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: mocks.withSystemContext,
  withRLSContext: mocks.withRLSContext,
}))

const { POST } = await import('@/app/api/cron/calendar-sync/route')

const SECRET = 'calendar-cron-secret'
const post = (headers: Record<string, string> = {}) =>
  POST(new NextRequest('https://example.com/api/cron/calendar-sync', { method: 'POST', headers }), {} as Record<string, unknown>)

describe('POST /api/cron/calendar-sync (retired: UE-ACTION-CALENDAR-SYNC is NOT_IMPLEMENTED)', () => {
  const previous = process.env.CRON_SECRET_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET_KEY = SECRET
    return () => {
      if (previous === undefined) delete process.env.CRON_SECRET_KEY
      else process.env.CRON_SECRET_KEY = previous
    }
  })

  it('answers 501 to the scheduler and names the capability, instead of a success that did nothing', async () => {
    const response = await post({ 'x-cron-secret': SECRET })
    expect(response.status).toBe(501)
    const body = await response.json()
    expect(JSON.stringify(body)).toContain('NOT_IMPLEMENTED')
    expect(JSON.stringify(body)).toContain('UE-ACTION-CALENDAR-SYNC')
  })

  it('reads and writes nothing: no database statement, no system context, no tenant context', async () => {
    await post({ 'x-cron-secret': SECRET })
    expect(mocks.statement).not.toHaveBeenCalled()
    expect(mocks.withSystemContext).not.toHaveBeenCalled()
    expect(mocks.withRLSContext).not.toHaveBeenCalled()
  })

  it('still refuses a caller without the cron secret', async () => {
    const response = await post({ 'x-cron-secret': 'wrong' })
    expect(response.status).toBe(401)
  })
})
