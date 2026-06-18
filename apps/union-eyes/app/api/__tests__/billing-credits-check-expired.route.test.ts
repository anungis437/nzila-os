import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  expireTrials: vi.fn(),
  logger: { info: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (message: string) => new Error(message) },
}));
vi.mock('@/services/platform-economics/subscription-lifecycle-service', () => ({ expireTrials: m.expireTrials }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../billing/credits/check-expired/route');
}

describe('billing/credits/check-expired route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.expireTrials.mockResolvedValue([{ organizationId: 'org_1', action: 'expired' }]);
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({})).rejects.toThrow('Organization context required');
  });

  it('returns expired trial actions and count', async () => {
    const { POST } = await loadRoute();

    const result = await POST({ organizationId: 'org_1', userId: 'u1' });

    expect(result).toMatchObject({ data: { expiredCount: 1, actions: [{ organizationId: 'org_1', action: 'expired' }] } });
    expect(m.expireTrials).toHaveBeenCalled();
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('returns empty actions when no trials expire', async () => {
    const { POST } = await loadRoute();
    m.expireTrials.mockResolvedValueOnce([]);

    const result = await POST({ organizationId: 'org_1', userId: 'u1' });

    expect(result).toMatchObject({ data: { expiredCount: 0, actions: [] } });
    expect(m.logger.info).toHaveBeenCalledWith('Expired trials check completed', expect.objectContaining({ expiredCount: 0 }));
  });
});