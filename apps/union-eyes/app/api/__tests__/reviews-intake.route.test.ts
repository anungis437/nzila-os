import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorityStoreError } from '@/lib/authority/store/executor'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  organization: vi.fn(),
  open: vi.fn(),
  list: vi.fn(),
  rlsContext: vi.fn(),
  audit: vi.fn(),
  logError: vi.fn(),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/logger', () => ({ logger: { error: m.logError, warn: vi.fn(), info: vi.fn() } }))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.organization }))
vi.mock('@/lib/db/with-rls-context', () => ({
  // The route passes the organization it resolved explicitly, so the database context is never a second resolution.
  withRLSContext: async (first: unknown, second?: (tx: unknown) => unknown) => {
    m.rlsContext(typeof first === 'function' ? undefined : first)
    return (typeof first === 'function' ? first : second!)({})
  },
}))
vi.mock('@/lib/authority/store/route-adapter', () => ({
  drizzleExecutor: (tx: unknown) => tx,
  kernelDeps: { memberships: vi.fn() },
}))
vi.mock('@/lib/authority/store/review-intake', () => ({
  openMemberReview: m.open,
  listMemberReviewIntake: m.list,
}))

const ORG = '22222222-2222-4222-8222-222222222222'

describe('/api/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue({ userId: 'user_member' })
    m.organization.mockResolvedValue(ORG)
  })

  it('opens a review for the session member and reports that no notice was sent', async () => {
    m.open.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      reviewType: 'complaint',
      status: 'open',
      created: true,
      notificationDelivered: false,
      notificationPolicy: 'not_adopted',
    })
    const { POST } = await import('../reviews/route')
    const response = await POST(new Request('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviewType: 'complaint', adverseUserIds: ['user_other'] }),
    }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body).toMatchObject({ success: true, notificationDelivered: false, notificationPolicy: 'not_adopted' })
    expect(body.adverseUserIds).toBeUndefined()
    expect(m.open).toHaveBeenCalledWith(expect.anything(), expect.anything(), {
      organizationId: ORG,
      actorUserId: 'user_member',
      reviewType: 'complaint',
      adverseUserIds: ['user_other'],
    })
  })

  it('rejects a body that names the opener, the organization or a classification', async () => {
    const { POST } = await import('../reviews/route')
    const response = await POST(new Request('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviewType: 'complaint', openedBy: 'forged', organizationId: ORG, classification: 'privileged' }),
    }))
    expect(response.status).toBe(400)
    expect(m.open).not.toHaveBeenCalled()
  })

  it('returns 403 when the member is not active and does not write', async () => {
    m.open.mockRejectedValue(new AuthorityStoreError('DENIED', 'NOT_AN_ACTIVE_MEMBER: only an active member may open or read a review'))
    const { POST } = await import('../reviews/route')
    const response = await POST(new Request('http://localhost/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ reviewType: 'appeal' }),
    }))
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'NOT_AN_ACTIVE_MEMBER' })
  })

  it('lists only what the store returned for this session', async () => {
    m.list.mockResolvedValue({
      own: [],
      oversight: [{ id: '11111111-1111-4111-8111-111111111111', reviewType: 'appeal', status: 'open', complainantUserId: 'user_member_2' }],
      notificationDelivered: false,
      notificationPolicy: 'not_adopted',
    })
    const { GET } = await import('../reviews/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.oversight).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('adverse')
    expect(m.list).toHaveBeenCalledWith(expect.anything(), expect.anything(), { organizationId: ORG, actorUserId: 'user_member' })
  })

  describe('hardening (Gate 0 DEF-0C1-REV)', () => {
    const post = async (body: BodyInit, headers: Record<string, string> = {}) => {
      const { POST } = await import('../reviews/route')
      return POST(new Request('http://localhost/api/reviews', { method: 'POST', body, headers }))
    }

    it('refuses an oversized body before parsing it, by declared length and by actual length', async () => {
      const declared = await post('{}', { 'content-length': '999999' })
      expect(declared.status).toBe(413)
      const actual = await post(JSON.stringify({ reviewType: 'complaint', adverseUserIds: ['x'.repeat(5000)] }))
      expect(actual.status).toBe(413)
      expect(m.open).not.toHaveBeenCalled()
    })

    it('runs the database context in exactly the organization the route resolved', async () => {
      m.open.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', reviewType: 'complaint', status: 'open', created: true, notificationDelivered: false, notificationPolicy: 'not_adopted' })
      await post(JSON.stringify({ reviewType: 'complaint' }))
      expect(m.rlsContext).toHaveBeenCalledWith({ organizationId: ORG })
      m.list.mockResolvedValue({ own: [], oversight: [], notificationDelivered: false, notificationPolicy: 'not_adopted' })
      const { GET } = await import('../reviews/route')
      await GET()
      expect(m.rlsContext).toHaveBeenLastCalledWith({ organizationId: ORG })
    })

    it('answers a repeat of an already open review with that review and 200, not a second 201', async () => {
      m.open.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', reviewType: 'complaint', status: 'open', created: false, notificationDelivered: false, notificationPolicy: 'not_adopted' })
      const response = await post(JSON.stringify({ reviewType: 'complaint' }))
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ alreadyOpen: true, id: '11111111-1111-4111-8111-111111111111' })
    })

    it('answers the daily intake limit with 429 and Retry-After', async () => {
      m.open.mockRejectedValue(new AuthorityStoreError('PRECONDITION', 'REVIEW_INTAKE_LIMIT: too many reviews opened today'))
      const response = await post(JSON.stringify({ reviewType: 'complaint' }))
      expect(response.status).toBe(429)
      expect(response.headers.get('retry-after')).toBe('3600')
    })

    it('logs and answers an unexpected failure in the structured shape instead of throwing', async () => {
      m.open.mockRejectedValue(new Error('connection terminated'))
      const response = await post(JSON.stringify({ reviewType: 'complaint' }))
      expect(response.status).toBe(500)
      const text = await response.text()
      expect(JSON.parse(text)).toEqual({ success: false, error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' })
      expect(text).not.toContain('connection terminated')
      expect(m.logError).toHaveBeenCalled()
    })

    it('answers an unauthenticated caller with 401 rather than a framework error', async () => {
      m.auth.mockResolvedValue({ userId: null })
      const response = await post(JSON.stringify({ reviewType: 'complaint' }))
      expect(response.status).toBe(401)
    })

    it('records an oversight read in the same transaction, naming the reviews disclosed, and records nothing for an own-only list', async () => {
      const id = '11111111-1111-4111-8111-111111111111'
      m.list.mockResolvedValue({ own: [], oversight: [{ id, reviewType: 'appeal', status: 'open', complainantUserId: 'user_member_2', classification: 'privileged' }], notificationDelivered: false, notificationPolicy: 'not_adopted' })
      const { GET } = await import('../reviews/route')
      await GET()
      expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        organizationId: ORG, userId: 'user_member', action: 'review.oversight.read', resourceType: 'governance_review',
        details: expect.objectContaining({ reviewIds: [id], privilegedCount: 1 }),
      }))
      m.audit.mockClear()
      m.list.mockResolvedValue({ own: [], oversight: [], notificationDelivered: false, notificationPolicy: 'not_adopted' })
      await GET()
      expect(m.audit).not.toHaveBeenCalled()
    })
  })})
