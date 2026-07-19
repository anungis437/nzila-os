import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyEnrollment: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
vi.mock('@nzila/platform-auth/mfa', () => ({ verifyEnrollment: m.verifyEnrollment }));

async function loadRoute() {
  return import('../auth/mfa/verify-enroll/route');
}

describe('auth/mfa/verify-enroll route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.verifyEnrollment.mockResolvedValue({ success: true });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/verify-enroll', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '123456' }),
    }));

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid code format', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/verify-enroll', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'abc' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when verification fails', async () => {
    const { POST } = await loadRoute();
    m.verifyEnrollment.mockResolvedValueOnce({ success: false, error: 'invalid_code' });

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/verify-enroll', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '123456' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns ok on successful verification', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/verify-enroll', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: '123456' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ ok: true });
  });

  it('returns 400 when request JSON cannot be parsed', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/verify-enroll', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid json',
    }));

    expect(response.status).toBe(400);
  });
});