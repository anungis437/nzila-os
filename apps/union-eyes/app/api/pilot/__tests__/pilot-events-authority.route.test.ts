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
}))

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_role: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/services/pilot-tracking', () => ({
  trackPilotEvent: mocks.trackPilotEvent,
  trackCaseCreated: mocks.trackCaseCreated,
  trackUpdateAdded: mocks.trackUpdateAdded,
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

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
    const res = await post({ eventType: 'case_created', sessionId: 's1', metadata: { caseId: 'c1' } })

    expect(res.status).toBe(200)
    expect(mocks.trackCaseCreated).toHaveBeenCalledWith('caller', 'caller-org', 's1', 'c1')
  })
})
