import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => {
  const { ApiError, ErrorCode } = await import('@/lib/api/errors');
  return { withApi: m.withApi, ApiError, ErrorCode };
});

async function loadRoute() {
  return import('../admin/members/export/route');
}

describe('admin/members/export route (not implemented)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx));
  });

  it('POST refuses with NOT_IMPLEMENTED instead of claiming an export was accepted', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ request: { json: vi.fn(async () => ({ format: 'csv' })) } })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('POST refuses regardless of the body', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ request: { json: vi.fn(async () => { throw new Error('bad json'); }) } })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('GET refuses with NOT_IMPLEMENTED instead of returning an empty list as a status', async () => {
    const { GET } = await loadRoute();
    await expect(GET({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
