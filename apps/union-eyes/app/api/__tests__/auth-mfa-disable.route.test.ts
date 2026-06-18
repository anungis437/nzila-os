import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  disableMfa: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
vi.mock('@nzila/platform-auth/mfa', () => ({ disableMfa: m.disableMfa }));

async function loadRoute() {
  return import('../auth/mfa/disable/route');
}

describe('auth/mfa/disable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.disableMfa.mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/disable', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'self_service' }),
    }));

    expect(response.status).toBe(401);
  });

  it('returns 400 when request body is invalid', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/disable', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 1 }),
    }));

    expect(response.status).toBe(400);
  });

  it('disables MFA with default reason when omitted', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/disable', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
    expect(m.disableMfa).toHaveBeenCalledWith('user_1', 'user_1', 'self_service');
  });

  it('disables MFA with explicit reason', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/disable', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'security_incident' }),
    }));

    expect(response.status).toBe(200);
    expect(m.disableMfa).toHaveBeenCalledWith('user_1', 'user_1', 'security_incident');
  });

  it('falls back to empty body when request JSON is invalid', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/disable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid json',
    }));

    expect(response.status).toBe(200);
    expect(m.disableMfa).toHaveBeenCalledWith('user_1', 'user_1', 'self_service');
  });
});