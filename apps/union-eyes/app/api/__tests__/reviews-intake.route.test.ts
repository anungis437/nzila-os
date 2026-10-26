import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthorityStoreError } from '@/lib/authority/store/executor'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  organization: vi.fn(),
  open: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.organization }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (fn: (tx: unknown) => unknown) => fn({}),
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
})
