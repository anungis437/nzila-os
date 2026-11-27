/**
 * Step 1 S1-A06 / C03: invitation reissue and revocation are refused to anyone who cannot manage this organization's
 * invitations, before any invite is touched; a refused or failed change never answers success.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  canManage: vi.fn(), revokeInvite: vi.fn(), reissueInvite: vi.fn(), list: vi.fn(), deliver: vi.fn(),
  authed: true,
}))
vi.mock('@/lib/organization-middleware', () => ({
  // The real wrapper authenticates and binds the organization; here it is reduced to that contract: no session, 401.
  withOrganizationAuth: (handler: (req: Request, ctx: { userId: string; organizationId: string }) => Promise<Response>) =>
    async (req: Request) => m.authed
      ? handler(req, { userId: 'actor-1', organizationId: 'org-1' })
      : new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401 }),
}))
vi.mock('@nzila/platform-auth/invites', () => ({
  canManageOrganizationInvites: m.canManage, revokeInvite: m.revokeInvite, reissueInvite: m.reissueInvite, listOrganizationInvites: m.list,
}))
vi.mock('@/lib/members/invitation-delivery', () => ({ deliverOrganizationInvitation: m.deliver }))

const INVITE = '0b7c5a3e-1f2d-4c3b-9a8e-0000000000f1'
const post = async (body: unknown) => {
  const { POST } = await import('../auth/invite/manage/route')
  return (POST as unknown as (r: Request) => Promise<Response>)(new Request('http://localhost/api/auth/invite/manage', { method: 'POST', body: JSON.stringify(body) }))
}

describe('POST /api/auth/invite/manage refusals', () => {
  beforeEach(() => { vi.clearAllMocks(); m.authed = true; m.canManage.mockResolvedValue(true) })

  it('refuses an unauthenticated caller with 401 and touches no invite', async () => {
    m.authed = false
    expect((await post({ action: 'revoke', inviteId: INVITE })).status).toBe(401)
    expect(m.revokeInvite).not.toHaveBeenCalled()
  })
  it('refuses a member who cannot manage invitations with 403, for revoke and reissue, before reading the body', async () => {
    m.canManage.mockResolvedValue(false)
    for (const action of ['revoke', 'reissue']) expect((await post({ action, inviteId: INVITE })).status).toBe(403)
    expect(m.canManage).toHaveBeenCalledWith('actor-1', 'org-1')
    expect(m.revokeInvite).not.toHaveBeenCalled()
    expect(m.reissueInvite).not.toHaveBeenCalled()
  })
  it('refuses a malformed action or invite id with 400', async () => {
    expect((await post({ action: 'delete', inviteId: INVITE })).status).toBe(400)
    expect((await post({ action: 'revoke', inviteId: 'not-a-guid' })).status).toBe(400)
    expect((await post({ action: 'revoke', inviteId: INVITE, organizationId: 'org-2' })).status).toBe(400)
    expect(m.revokeInvite).not.toHaveBeenCalled()
  })
  it('scopes the change to the bound organization and actor, and a refused change is 409, never success', async () => {
    m.revokeInvite.mockResolvedValue({ success: false, error: 'NOT_PENDING' })
    expect((await post({ action: 'revoke', inviteId: INVITE })).status).toBe(409)
    expect(m.revokeInvite).toHaveBeenCalledWith(expect.objectContaining({ inviteId: INVITE, actorUserId: 'actor-1', organizationId: 'org-1' }))
    m.reissueInvite.mockResolvedValue({ success: false, error: 'NOT_PENDING' })
    expect((await post({ action: 'reissue', inviteId: INVITE })).status).toBe(409)
    expect(m.deliver).not.toHaveBeenCalled()
  })

  it('GET (C04): an unauthenticated caller gets 401 and a non-manager 403, and neither sees any invitation', async () => {
    const { GET } = await import('../auth/invite/manage/route')
    const get = () => (GET as unknown as (r: Request) => Promise<Response>)(new Request('http://localhost/api/auth/invite/manage'))
    m.authed = false
    expect((await get()).status).toBe(401)
    m.authed = true
    m.canManage.mockResolvedValue(false)
    const refused = await get()
    expect(refused.status).toBe(403)
    expect(JSON.stringify(await refused.json())).not.toContain('invitations')
    expect(m.list).not.toHaveBeenCalled()
    m.canManage.mockResolvedValue(true)
    m.list.mockResolvedValue([])
    expect((await get()).status).toBe(200)
    expect(m.list).toHaveBeenCalledWith('actor-1', 'org-1')
  })
})
