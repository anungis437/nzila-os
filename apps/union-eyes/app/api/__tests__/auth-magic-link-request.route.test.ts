import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requestMagicLink: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  logEmailDeliveryFailure: vi.fn(),
}));

vi.mock('@nzila/platform-auth/magic-link', () => ({ requestMagicLink: m.requestMagicLink }));
vi.mock('@/lib/auth-emails', () => ({ sendMagicLinkEmail: m.sendMagicLinkEmail, logEmailDeliveryFailure: m.logEmailDeliveryFailure }));

async function loadRoute() {
  return import('../auth/magic-link/request/route');
}

describe('auth/magic-link/request route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requestMagicLink.mockResolvedValue({ token: 'tok_1', expiresAt: '2030-01-01T00:00:00.000Z' });
    m.sendMagicLinkEmail.mockResolvedValue({ success: true });
    process.env.NODE_ENV = 'test';
  });

  it('returns 400 for invalid request body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/magic-link/request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bad' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns neutral message when token is minted', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/auth/magic-link/request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toContain('If that email is recognised');
    expect(m.sendMagicLinkEmail).toHaveBeenCalled();
  });

  it('logs delivery failure but still returns neutral response', async () => {
    const { POST } = await loadRoute();
    m.sendMagicLinkEmail.mockResolvedValueOnce({ success: false, error: 'mail_error' });

    const response = await POST(new NextRequest('http://localhost/api/auth/magic-link/request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));

    expect(response.status).toBe(200);
    expect(m.logEmailDeliveryFailure).toHaveBeenCalled();
  });

  it('returns dev payload with token in development mode', async () => {
    const { POST } = await loadRoute();
    process.env.NODE_ENV = 'development';

    const response = await POST(new NextRequest('http://localhost/api/auth/magic-link/request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ token: 'tok_1', delivery: 'sent' });
  });

  it('returns 500 when an unexpected error is thrown', async () => {
    const { POST } = await loadRoute();
    m.requestMagicLink.mockRejectedValueOnce(new Error('unexpected'));

    const response = await POST(new NextRequest('http://localhost/api/auth/magic-link/request', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'user@example.com' }),
    }));

    expect(response.status).toBe(500);
  });
});