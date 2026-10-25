import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (...args: unknown[]) => unknown) => handler,
}));

describe('admin/system/cache route (retired)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says it performs no operation instead of claiming a cache was cleared', async () => {
    const { POST } = await import('../admin/system/cache/route');
    const response = await (POST as any)();
    expect(response.status).toBe(501);
    const payload = await response.json();
    expect(payload.error.code).toBe('NOT_IMPLEMENTED');
    expect(JSON.stringify(payload)).not.toMatch(/cleared/i);
  });
});
