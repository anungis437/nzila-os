import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = { selectRows: [] as unknown[][] };
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (state.selectRows.shift() ?? []) as unknown[]),
    };
    return chain;
  };
  return {
    state,
    auth: vi.fn(),
    enrollMfa: vi.fn(),
    authDb: { select: vi.fn(() => createSelectChain()) },
    withAuthenticatedAuthContext: vi.fn(async (_userId: string, callback: () => Promise<unknown>) => callback()),
  };
});

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
// The ambient handle must never be used: the identity row is read through the auth execution boundary.
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@nzila/platform-auth/auth-execution', () => ({
  authDb: m.authDb,
  withAuthenticatedAuthContext: m.withAuthenticatedAuthContext,
}));
vi.mock('@nzila/platform-auth/mfa', () => ({ enrollMfa: m.enrollMfa }));
vi.mock('@nzila/db/schema', () => ({ authUsers: { email: 'email', userId: 'userId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../auth/mfa/enroll/route');
}

describe('auth/mfa/enroll route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.selectRows = [];
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.enrollMfa.mockResolvedValue({
      success: true,
      otpAuthUri: 'otpauth://totp/demo',
      secret: 'secret_1',
      recoveryCodes: ['a', 'b'],
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(m.withAuthenticatedAuthContext).not.toHaveBeenCalled();
  });

  it('returns 404 when user record is missing', async () => {
    const { POST } = await loadRoute();
    m.state.selectRows.push([]);

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));

    expect(response.status).toBe(404);
    expect(m.enrollMfa).not.toHaveBeenCalled();
  });

  it('returns 409 when MFA enrollment fails', async () => {
    const { POST } = await loadRoute();
    m.state.selectRows.push([{ email: 'u@example.com' }]);
    m.enrollMfa.mockResolvedValueOnce({ success: false, error: 'already_enrolled' });

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));

    expect(response.status).toBe(409);
  });

  it('returns enrollment payload on success', async () => {
    const { POST } = await loadRoute();
    m.state.selectRows.push([{ email: 'u@example.com' }]);

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ otpAuthUri: 'otpauth://totp/demo', secret: 'secret_1', recoveryCodes: ['a', 'b'] });
  });

  it('reads the identity row inside the authenticated auth context of the session user, never through the ambient handle', async () => {
    const { POST } = await loadRoute();
    m.state.selectRows.push([{ email: 'u@example.com' }]);

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));

    expect(response.status).toBe(200);
    expect(m.withAuthenticatedAuthContext).toHaveBeenCalledTimes(1);
    expect(m.withAuthenticatedAuthContext).toHaveBeenCalledWith('user_1', expect.any(Function));
    expect(m.authDb.select).toHaveBeenCalledTimes(1);
    expect(m.enrollMfa).toHaveBeenCalledWith({ userId: 'user_1', userEmail: 'u@example.com', issuer: 'UnionEyes' });
  });
});