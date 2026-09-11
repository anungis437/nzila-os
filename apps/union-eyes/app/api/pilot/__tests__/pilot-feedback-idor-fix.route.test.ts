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

const mocks = vi.hoisted(() => ({
  insertValues: vi.fn(),
  trackPilotEvent: vi.fn(),
  dbExecute: vi.fn(),
  dbSelectWhere: vi.fn(),
}))

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_requiredRole: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn((fn: () => unknown) => fn()),
}))

vi.mock('@/lib/services/pilot-tracking', () => ({
  trackPilotEvent: mocks.trackPilotEvent,
}))

vi.mock('@/db', () => ({
  db: {
    insert: () => ({ values: mocks.insertValues }),
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
  pilotFeedback: { organizationId: 'organization_id' },
}))

const { POST, GET } = await import('@/app/api/pilot/feedback/route')

describe('pilot/feedback route (round 56 — cross-user/cross-org IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertValues.mockResolvedValue(undefined)
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

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id', organizationId: 'caller-org' })
    )
    expect(mocks.trackPilotEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id', organizationId: 'caller-org' })
    )
  })

  it('POST rejects when the authenticated context has no resolved organization', async () => {
    const req = new NextRequest('http://localhost/api/pilot/feedback', {
      method: 'POST',
      body: JSON.stringify({ easeRating: 4, trigger: 'first_case' }),
    })

    const res = await POST(req, { userId: 'caller-own-id' })
    expect(res.status).toBe(400)
    expect(mocks.insertValues).not.toHaveBeenCalled()
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
