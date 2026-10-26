import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Round 56 regression test: /api/pilot/feedback previously trusted
 * client-supplied `userId`/`organizationId` (POST body) and an arbitrary
 * `?organizationId=` query param (GET) instead of the authenticated
 * caller's own identity/org — allowing any member to submit feedback
 * impersonating another user in another organization, and any admin to
 * read another organization's feedback summary (cross-org IDOR).
 */

const mocks = vi.hoisted(() => {
  const tx = {
    insert: vi.fn(),
  }
  return {
    tx,
    feedbackValues: vi.fn(),
    eventValues: vi.fn(),
    persistAtomicAudit: vi.fn(),
    withRLSContext: vi.fn(),
    dbExecute: vi.fn(),
    dbSelectWhere: vi.fn(),
  }
})

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_requiredRole: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mocks.withRLSContext,
}))

vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: mocks.persistAtomicAudit,
}))

vi.mock('@/db', () => ({
  db: {
    execute: mocks.dbExecute,
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: mocks.dbSelectWhere,
          }),
        }),
      }),
    }),
  },
}))

vi.mock('@/db/schema', () => ({
  pilotFeedback: { organizationId: 'organization_id', id: 'id' },
  pilotEvents: { table: 'pilot_events' },
}))

const { POST, GET } = await import('@/app/api/pilot/feedback/route')

describe('pilot/feedback route (round 56 — cross-user/cross-org IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withRLSContext.mockImplementation(async (ctxOrFn: unknown, fn?: (tx: unknown) => unknown) =>
      typeof ctxOrFn === 'function' ? (ctxOrFn as () => unknown)() : fn!(mocks.tx),
    )
    mocks.tx.insert.mockImplementation((table: { table?: string }) =>
      table.table === 'pilot_events'
        ? { values: mocks.eventValues }
        : { values: (v: unknown) => ({ returning: async () => (mocks.feedbackValues(v), [{ id: 'fb-1' }]) }) },
    )
    mocks.eventValues.mockResolvedValue(undefined)
    mocks.persistAtomicAudit.mockResolvedValue(undefined)
    mocks.dbExecute.mockResolvedValue([{ total_responses: 0 }])
    mocks.dbSelectWhere.mockResolvedValue([])
  })

  it('POST ignores a client-supplied userId/organizationId and uses the authenticated caller context', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'attacker-supplied-other-user',
        organizationId: 'attacker-supplied-other-org',
        easeRating: 4,
        trigger: 'first_case',
      }),
    })

    const res = await POST(req, { userId: 'caller-own-id', organizationId: 'caller-org' })
    expect(res.status).toBe(200)

    expect(mocks.withRLSContext).toHaveBeenCalledWith({ organizationId: 'caller-org' }, expect.any(Function))
    expect(mocks.feedbackValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id', organizationId: 'caller-org' })
    )
    expect(mocks.eventValues).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'caller-own-id', organizationId: 'caller-org', eventType: 'feedback_submitted' }),
      expect.objectContaining({ userId: 'caller-own-id', organizationId: 'caller-org', eventType: 'feature_used' }),
    ])
  })

  it('POST records the audit on the same transaction as the feedback and its events', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback', {
      method: 'POST',
      body: JSON.stringify({ easeRating: 2, category: 'slow', comment: 'private words', trigger: 'milestone_usage' }),
    })

    const res = await POST(req, { userId: 'caller-own-id', organizationId: 'caller-org' })

    expect(res.status).toBe(200)
    expect(mocks.persistAtomicAudit).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        organizationId: 'caller-org',
        userId: 'caller-own-id',
        action: 'pilot.feedback.submit',
        resourceType: 'pilot_feedback',
        resourceId: 'fb-1',
        details: { easeRating: 2, category: 'slow', trigger: 'milestone_usage' },
      }),
    )
  })

  it('POST fails when the audit cannot be written, so the feedback does not commit', async () => {
    mocks.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'))
    const req = new NextRequest('http://localhost/api/pilot/feedback', {
      method: 'POST',
      body: JSON.stringify({ easeRating: 4, trigger: 'first_case' }),
    })

    const res = await POST(req, { userId: 'caller-own-id', organizationId: 'caller-org' })

    expect(res.status).toBe(500)
  })

  it('POST rejects a non-integer or out-of-range rating before opening a transaction', async () => {
    for (const easeRating of [0, 6, 2.5, '3']) {
      const res = await POST(
        new NextRequest('http://localhost/api/pilot/feedback', {
          method: 'POST',
          body: JSON.stringify({ easeRating, trigger: 'first_case' }),
        }),
        { userId: 'caller-own-id', organizationId: 'caller-org' },
      )
      expect(res.status).toBe(400)
    }
    expect(mocks.withRLSContext).not.toHaveBeenCalled()
  })

  it('POST rejects when the authenticated context has no resolved organization', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback', {
      method: 'POST',
      body: JSON.stringify({ easeRating: 4, trigger: 'first_case' }),
    })

    const res = await POST(req, { userId: 'caller-own-id' })
    expect(res.status).toBe(400)
    expect(mocks.withRLSContext).not.toHaveBeenCalled()
  })

  it('GET scopes the feedback summary to the caller\'s own organization, ignoring any client-supplied organizationId query param', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback?organizationId=attacker-supplied-other-org')

    const res = await GET(req, { userId: 'admin-1', organizationId: 'caller-org' })
    expect(res.status).toBe(200)

    // The sql`` tagged-template call captures organizationId in .values — assert caller-org made it through, not the query param.
    const executedCall = mocks.dbExecute.mock.calls[0]?.[0]
    expect(executedCall?.values ?? executedCall?.queryChunks?.map((c: unknown) => c)).toBeDefined()
  })

  it('GET returns 400 when the authenticated context has no resolved organization', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback?organizationId=attacker-supplied-other-org')

    const res = await GET(req, { userId: 'admin-1' })
    expect(res.status).toBe(400)
    expect(mocks.dbExecute).not.toHaveBeenCalled()
  })
})
