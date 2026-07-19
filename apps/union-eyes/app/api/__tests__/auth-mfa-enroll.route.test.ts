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
    db: { select: vi.fn(() => createSelectChain()) },
  };
});

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: m.db }));
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
  });

  it('returns 404 when user record is missing', async () => {
    const { POST } = await loadRoute();
    m.state.selectRows.push([]);

    const response = await POST(new NextRequest('http://localhost/api/auth/mfa/enroll', { method: 'POST' }));

    expect(response.status).toBe(404);
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
});