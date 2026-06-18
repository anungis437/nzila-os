import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getMfaStatus: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
vi.mock('@nzila/platform-auth/mfa', () => ({ getMfaStatus: m.getMfaStatus }));

async function loadRoute() {
  return import('../auth/mfa/status/route');
}

describe('auth/mfa/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.getMfaStatus.mockResolvedValue({ enrolled: true, enabled: true });
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it('returns MFA status for authenticated users', async () => {
    const { GET } = await loadRoute();

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ enrolled: true, enabled: true });
  });
});