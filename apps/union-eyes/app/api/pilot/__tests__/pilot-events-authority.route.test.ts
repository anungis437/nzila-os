import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * /api/pilot/events used to record the userId and organizationId named in the request body, so any member could write
 * usage events into another organization's pilot metrics. The identity now comes only from the authenticated context.
 */

const mocks = vi.hoisted(() => ({
  trackPilotEvent: vi.fn(),
  trackCaseCreated: vi.fn(),
  trackUpdateAdded: vi.fn(),
  claimRows: [{ claimId: '11111111-1111-4111-8111-111111111111' }] as Array<{ claimId: string }>,
}))

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_role: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/services/pilot-tracking', () => ({
  trackPilotEvent: mocks.trackPilotEvent,
  trackCaseCreated: mocks.trackCaseCreated,
  trackUpdateAdded: mocks.trackUpdateAdded,
}))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (...args: any[]) => (args[1] ?? args[0])()),
}))

vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.claimRows }) }) }) },
}))

vi.mock('@/db/schema', () => ({ claims: { claimId: 'claim_id', organizationId: 'organization_id' } }))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

const CASE_ID_PLACEHOLDER = '11111111-1111-4111-8111-111111111111'
const { POST } = await import('@/app/api/pilot/events/route')

const post = (body: unknown, context: Record<string, unknown> = { userId: 'caller', organizationId: 'caller-org' }) =>
  POST(new NextRequest('http://localhost/api/pilot/events', { method: 'POST', body: JSON.stringify(body) }), context)

describe('pilot/events route — identity comes from the authenticated context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.trackPilotEvent.mockResolvedValue(undefined)
  })

  it('records the event for the caller when the body omits the identity', async () => {
    const res = await post({ eventType: 'feature_used', sessionId: 's1', metadata: { feature: 'x' } })

    expect(res.status).toBe(200)
    expect(mocks.trackPilotEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller', organizationId: 'caller-org', sessionId: 's1' }),
    )
  })

  it('accepts a body whose identity matches the authenticated context', async () => {
    const res = await post({ eventType: 'feature_used', sessionId: 's1', userId: 'caller', organizationId: 'caller-org' })

    expect(res.status).toBe(200)
  })

  it('refuses (403) a body naming another organization or another user, and records nothing', async () => {
    const otherOrg = await post({ eventType: 'feature_used', sessionId: 's1', userId: 'caller', organizationId: 'victim-org' })
    const otherUser = await post({ eventType: 'feature_used', sessionId: 's1', userId: 'victim', organizationId: 'caller-org' })

    expect(otherOrg.status).toBe(403)
    expect(otherUser.status).toBe(403)
    expect(mocks.trackPilotEvent).not.toHaveBeenCalled()
    expect(mocks.trackCaseCreated).not.toHaveBeenCalled()
  })

  it('refuses a caller with no resolved organization', async () => {
    const res = await post({ eventType: 'feature_used', sessionId: 's1' }, { userId: 'caller' })

    expect(res.status).toBe(400)
    expect(mocks.trackPilotEvent).not.toHaveBeenCalled()
  })

  it('routes case_created through the tracker with the authenticated identity', async () => {
    const res = await post({ eventType: 'case_created', sessionId: 's1', metadata: { caseId: CASE_ID_PLACEHOLDER } })

    expect(res.status).toBe(200)
    expect(mocks.trackCaseCreated).toHaveBeenCalledWith('caller', 'caller-org', 's1', CASE_ID_PLACEHOLDER)
  })
})

// DEF-0B10-PIL-USAGE-EVENTS-ARE-CALLER-ASSERTED
describe('pilot/events route — a browser cannot assert what only the server does', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.trackPilotEvent.mockResolvedValue(undefined)
    mocks.claimRows = [{ claimId: CASE_ID_PLACEHOLDER }]
  })

  it.each(['first_case_created', 'org_created', 'user_invited', 'role_assigned', 'case_closed', 'first_update_added', 'sla_breached'])(
    'refuses the server-recorded type %s with 400',
    async (eventType) => {
      const res = await post({ eventType, sessionId: 's1' })
      expect(res.status).toBe(400)
      expect(mocks.trackPilotEvent).not.toHaveBeenCalled()
    },
  )

  it('refuses case_created for a case that is not in the caller organization (404) and records nothing', async () => {
    mocks.claimRows = []
    const res = await post({ eventType: 'case_created', sessionId: 's1', metadata: { caseId: CASE_ID_PLACEHOLDER } })
    expect(res.status).toBe(404)
    expect(mocks.trackCaseCreated).not.toHaveBeenCalled()
  })

  it('refuses a case-bound event with no case id or a non-uuid id', async () => {
    expect((await post({ eventType: 'update_added', sessionId: 's1' })).status).toBe(400)
    expect((await post({ eventType: 'update_added', sessionId: 's1', metadata: { caseId: 'c1' } })).status).toBe(404)
    expect(mocks.trackUpdateAdded).not.toHaveBeenCalled()
  })

  it('refuses a session id longer than the column (100)', async () => {
    expect((await post({ eventType: 'feature_used', sessionId: 's'.repeat(101) })).status).toBe(400)
  })
})

// DEF-0B10-PIL-PILOT-WRITE-ROUTES-CAST-THE-JSON-BODY-WITHOUT-A-SCHEMA-AND-STORE-CALLER-TEXT-IN-AN-UNBOUNDED-JSON
describe('pilot/events route — free-form fields are bounded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.trackPilotEvent.mockResolvedValue(undefined)
  })

  it.each([
    [{ eventType: 'feature_used', sessionId: 's'.repeat(101) }],
    [{ eventType: 'feature_used', sessionId: 5 }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: 'text' }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: [1] }],
    [{ eventType: 'feature_used', sessionId: 's1', metadata: { blob: 'x'.repeat(5000) } }],
    [{ eventType: 'case_created', sessionId: 's1', metadata: { caseId: { nested: true } } }],
  ])('refuses %j with 400 and records nothing', async (body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(mocks.trackPilotEvent).not.toHaveBeenCalled()
    expect(mocks.trackCaseCreated).not.toHaveBeenCalled()
  })

  it('refuses a body that is not a JSON object', async () => {
    const res = await POST(new NextRequest('http://localhost/api/pilot/events', { method: 'POST', body: '[1]' }), { userId: 'caller', organizationId: 'caller-org' })
    expect(res.status).toBe(400)
  })

  it('still records a small event', async () => {
    expect((await post({ eventType: 'feature_used', sessionId: 's1', metadata: { feature: 'x' } })).status).toBe(200)
  })
})
