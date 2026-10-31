import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B11-PRP-PROFILE-ME-GET-SWALLOWS-DATABASE-ERRORS-INTO-A-SUCCESS-WITH-NULL-DATA
const m = vi.hoisted(() => ({ auth: vi.fn(), findProfileByUserId: vi.fn() }));

vi.mock('@/lib/api-auth-guard', () => ({ auth: m.auth }));
vi.mock('@/db/queries/profiles-queries', () => ({ findProfileByUserId: m.findProfileByUserId }));

describe('profile/me GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user-1' });
  });

  it('returns the profile it found', async () => {
    m.findProfileByUserId.mockResolvedValue({ userId: 'user-1' });
    const { GET } = await import('../profile/me/route');

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isSuccess: true, message: 'Profile retrieved successfully', data: { userId: 'user-1' } });
  });

  it('says there is no profile only when the lookup completed and found none', async () => {
    m.findProfileByUserId.mockResolvedValue(null);
    const { GET } = await import('../profile/me/route');

    const body = await (await GET()).json();

    expect(body).toMatchObject({ isSuccess: true, data: null });
    expect(body.message).not.toContain('retrieved');
  });

  it('answers a failed or timed-out lookup as a failure, never as a retrieved profile', async () => {
    m.findProfileByUserId.mockRejectedValue(new Error('Database query timeout'));
    const { GET } = await import('../profile/me/route');

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ isSuccess: false });
  });

  it('refuses an anonymous caller', async () => {
    m.auth.mockResolvedValue({ userId: null });
    const { GET } = await import('../profile/me/route');

    expect((await GET()).status).toBe(401);
    expect(m.findProfileByUserId).not.toHaveBeenCalled();
  });
});
