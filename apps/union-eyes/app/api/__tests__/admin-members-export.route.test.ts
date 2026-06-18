import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));

async function loadRoute() {
  return import('../admin/members/export/route');
}

describe('admin/members/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
  });

  it('POST returns accepted export action', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      request: {
        json: vi.fn(async () => ({ format: 'csv' })),
      },
    });

    expect(result).toMatchObject({ action: 'export', status: 'accepted' });
  });

  it('POST still accepts malformed json body', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      request: {
        json: vi.fn(async () => {
          throw new Error('bad json');
        }),
      },
    });

    expect(result).toMatchObject({ action: 'export', status: 'accepted' });
  });

  it('GET returns empty status payload', async () => {
    const { GET } = await loadRoute();

    const result = await GET({});

    expect(result).toEqual([]);
  });
});