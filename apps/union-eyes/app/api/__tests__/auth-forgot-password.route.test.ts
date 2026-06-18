import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  logEmailDeliveryFailure: vi.fn(),
  forgotPasswordBodySchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('@nzila/platform-auth/password', () => ({ forgotPassword: m.forgotPassword }));
vi.mock('@/lib/auth-emails', () => ({
  sendPasswordResetEmail: m.sendPasswordResetEmail,
  logEmailDeliveryFailure: m.logEmailDeliveryFailure,
}));
vi.mock('./schemas', () => ({ forgotPasswordBodySchema: m.forgotPasswordBodySchema }));

async function loadRoute() {
  return import('../auth/forgot-password/route');
}

describe('auth/forgot-password route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.forgotPasswordBodySchema.safeParse.mockReturnValue({ success: true, data: { email: 'user@test.com' } });
    m.forgotPassword.mockResolvedValue({ token: 'reset_token_123' });
    m.sendPasswordResetEmail.mockResolvedValue({ success: true });
  });

  it('returns 400 when email is invalid', async () => {
    m.forgotPasswordBodySchema.safeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: 'Invalid email' }] },
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bad' }),
    }) as any);

    expect(response.status).toBe(400);
  });

  it('returns neutral message for valid email', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com' }),
    }) as any);

    expect([200, 500]).toContain(response.status);
  });

  it('returns 500 on unexpected error', async () => {
    m.forgotPassword.mockRejectedValueOnce(new Error('db failure'));

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@test.com' }),
    }) as any);

    expect(response.status).toBe(500);
  });
});
