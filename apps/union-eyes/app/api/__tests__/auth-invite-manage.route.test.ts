import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ allowed: vi.fn(), list: vi.fn(), reissue: vi.fn(), revoke: vi.fn(), deliver: vi.fn() }));
vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: (handler: (request: NextRequest, context: { userId: string; organizationId: string }) => Promise<Response>) => (request: NextRequest) => handler(request, { userId: 'admin-a', organizationId: 'org-a' }) }));
vi.mock('@nzila/platform-auth/invites', () => ({ canManageOrganizationInvites: m.allowed, listOrganizationInvites: m.list, reissueInvite: m.reissue, revokeInvite: m.revoke }));
vi.mock('@/lib/members/invitation-delivery', () => ({ deliverOrganizationInvitation: m.deliver }));
import { GET, POST } from '../auth/invite/manage/route';
const id = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown) => new NextRequest('http://localhost/api/auth/invite/manage', { method: 'POST', body: JSON.stringify(body) });

describe('organization invitation management routes', () => {
  beforeEach(() => {
    vi.clearAllMocks(); m.allowed.mockResolvedValue(true); m.list.mockResolvedValue([]);
    m.reissue.mockResolvedValue({ success: true, inviteId: 'replacement', token: 'secret' });
    m.revoke.mockResolvedValue({ success: true }); m.deliver.mockResolvedValue({ inviteId: 'replacement', delivery: 'failed' });
  });
  it('refuses listing and both mutations without direct organization administration', async () => {
    m.allowed.mockResolvedValue(false);
    expect((await GET(new NextRequest('http://localhost/api/auth/invite/manage'))).status).toBe(403);
    for (const action of ['reissue', 'revoke']) expect((await POST(request({ action, inviteId: id }))).status).toBe(403);
    expect(m.list).not.toHaveBeenCalled(); expect(m.reissue).not.toHaveBeenCalled(); expect(m.revoke).not.toHaveBeenCalled();
  });
  it('lists only the authenticated active organization', async () => {
    expect((await GET(new NextRequest('http://localhost/api/auth/invite/manage?organizationId=other'))).status).toBe(200);
    expect(m.list).toHaveBeenCalledWith('admin-a', 'org-a');
  });
  it.each(['organizationId', 'actorUserId', 'email', 'role'])('rejects client override %s', async (key) => {
    expect((await POST(request({ action: 'reissue', inviteId: id, [key]: 'forged' }))).status).toBe(400);
    expect(m.reissue).not.toHaveBeenCalled();
  });
  it('uses the server actor and tenant for a replacement and withholds the secret', async () => {
    const response = await POST(request({ action: 'reissue', inviteId: id }));
    expect(response.status).toBe(201);
    expect(m.reissue).toHaveBeenCalledWith(expect.objectContaining({ inviteId: id, actorUserId: 'admin-a', organizationId: 'org-a' }));
    expect(await response.json()).toEqual({ inviteId: 'replacement', delivery: 'failed' });
  });
  it('does not email a terminal or unavailable invitation', async () => {
    m.reissue.mockResolvedValue({ success: false, error: 'Invitation is no longer available' });
    expect((await POST(request({ action: 'reissue', inviteId: id }))).status).toBe(409);
    expect(m.deliver).not.toHaveBeenCalled();
  });
  it('revokes without submitting an email', async () => {
    expect((await POST(request({ action: 'revoke', inviteId: id }))).status).toBe(200);
    expect(m.revoke).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'admin-a', organizationId: 'org-a' }));
    expect(m.deliver).not.toHaveBeenCalled();
  });
});
