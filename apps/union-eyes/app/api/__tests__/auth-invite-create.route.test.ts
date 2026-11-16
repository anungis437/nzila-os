import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  canManageOrganizationInvites: vi.fn(),
  createInvite: vi.fn(),
  sendInviteEmail: vi.fn(),
  logEmailDeliveryFailure: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@nzila/platform-auth/invites', () => ({ createInvite: m.createInvite, canManageOrganizationInvites: m.canManageOrganizationInvites }));
vi.mock('@/lib/auth-emails', () => ({ sendInviteEmail: m.sendInviteEmail, logEmailDeliveryFailure: m.logEmailDeliveryFailure }));

async function loadRoute() {
  return import('../auth/invite/create/route');
}

describe('auth/invite/create route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withOrganizationAuth.mockImplementation((handler: any) => (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context));
    m.canManageOrganizationInvites.mockResolvedValue(true);
    m.createInvite.mockResolvedValue({ success: true, inviteId: 'inv_1', token: 'tok_1', email: 'user@example.com', role: 'member', expiresAt: new Date('2030-01-01T00:00:00.000Z') });
    m.sendInviteEmail.mockResolvedValue({ success: true });
    process.env.NODE_ENV = 'test';
  });

  it('returns 403 for insufficient role', async () => {
    const { POST } = await loadRoute();
    m.canManageOrganizationInvites.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.com' }),
    }));

    expect(response.status).toBe(403);
    expect(m.createInvite).not.toHaveBeenCalled();
    expect(m.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid email payload', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bad' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when invite creation fails', async () => {
    const { POST } = await loadRoute();
    m.createInvite.mockResolvedValueOnce({ success: false, error: 'duplicate_invite' });

    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 201 and sent delivery when invite email is sent', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ email: 'user@example.com', role: 'member' }),
    }), { userId: 'u1', organizationId: 'org_1' });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ inviteId: 'inv_1', delivery: 'sent' });
    expect(m.createInvite).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', invitedBy: 'u1' }));
  });

  it('returns 201 and failed delivery when email sending fails', async () => {
    const { POST } = await loadRoute();
    m.sendInviteEmail.mockResolvedValueOnce({ success: false, error: 'smtp_down' });

    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({ delivery: 'failed' });
    expect(m.logEmailDeliveryFailure).toHaveBeenCalled();
  });

  it('rejects malformed JSON and null rather than reporting an internal error', async () => {
    const { POST } = await loadRoute();
    for (const body of ['null', '{', JSON.stringify({ email: 42 })]) {
      const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', { method: 'POST', body }));
      expect(response.status).toBe(400);
    }
  });

  it('ignores forged tenant, inviter and display-name fields and never returns the bearer', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', body: JSON.stringify({ email: 'user@example.com', organizationId: 'foreign', invitedBy: 'other', inviterName: 'spoofed' }),
    }));
    expect(m.canManageOrganizationInvites).toHaveBeenCalledWith('u1', 'org_1');
    expect(m.createInvite).toHaveBeenCalledWith(expect.objectContaining({ invitedBy: 'u1', organizationId: 'org_1' }));
    expect(m.sendInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({ inviterName: 'spoofed' }));
    expect(JSON.stringify(await response.json())).not.toContain('tok_1');
  });

  it('preserves the invitation and reports uncertainty when the email provider throws', async () => {
    const { POST } = await loadRoute();
    m.sendInviteEmail.mockRejectedValueOnce(new Error('sensitive provider URL'));
    const response = await POST(new NextRequest('http://localhost/api/auth/invite/create', {
      method: 'POST', body: JSON.stringify({ email: 'user@example.com' }),
    }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ inviteId: 'inv_1', delivery: 'failed' });
    expect(m.logEmailDeliveryFailure).toHaveBeenCalledWith('invite', 'user@example.com', 'Submission could not be confirmed');
  });

});
