import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => {
  const { ApiError, ErrorCode } = await import('@/lib/api/errors');
  return { withApi: m.withApi, ApiError, ErrorCode };
});

async function loadRoute() {
  return import('../admin/seed-test-data/route');
}

describe('admin/seed-test-data route (retired)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx));
  });

  it('GET refuses with NOT_IMPLEMENTED instead of reporting a seeded hierarchy', async () => {
    const { GET } = await loadRoute();
    await expect(GET({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('POST refuses with NOT_IMPLEMENTED instead of reporting a seeded hierarchy', async () => {
    const { POST } = await loadRoute();
    await expect(POST({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
