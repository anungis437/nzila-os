import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = { selectRows: [] as unknown[][], updateRows: [] as unknown[][] };
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(async () => (state.selectRows.shift() ?? []) as unknown[]),
    };
    return chain;
  };
  return {
    state,
    withApi: vi.fn(),
    logger: { info: vi.fn() },
    db: {
      select: vi.fn(() => createSelectChain()),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => (state.updateRows.shift() ?? []) as unknown[]),
          })),
        })),
      })),
    },
  };
});

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (message: string) => new Error(message),
    notFound: (message: string) => new Error(message),
  },
  z: require('zod'),
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ orgSubscriptions: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../billing/subscriptions/[id]/route');
}

describe('billing/subscriptions/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.selectRows = [];
    m.state.updateRows = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
  });

  it('GET throws when organization context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('Organization context required');
  });

  it('GET throws not found when subscription does not exist', async () => {
    const { GET } = await loadRoute();
    m.state.selectRows.push([]);

    await expect(GET({ organizationId: 'org_1', params: Promise.resolve({ id: 'sub_1' }) })).rejects.toThrow('Subscription not found');
  });

  it('GET returns subscription payload when found', async () => {
    const { GET } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1', status: 'active' }]);

    const result = await GET({ organizationId: 'org_1', params: Promise.resolve({ id: 'sub_1' }) });

    expect(result).toMatchObject({ data: { id: 'sub_1', status: 'active' } });
  });

  it('PATCH updates an existing subscription', async () => {
    const { PATCH } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1' }]);
    m.state.updateRows.push([{ id: 'sub_1', status: 'paused' }]);

    const result = await PATCH({
      organizationId: 'org_1',
      params: { id: 'sub_1' },
      request: { json: async () => ({ status: 'paused' }) },
    });

    expect(result).toMatchObject({ data: { id: 'sub_1', status: 'paused' } });
  });

  it('DELETE cancels an existing subscription', async () => {
    const { DELETE } = await loadRoute();
    m.state.selectRows.push([{ id: 'sub_1' }]);
    m.state.updateRows.push([{ id: 'sub_1', status: 'cancelled' }]);

    const result = await DELETE({ organizationId: 'org_1', params: { id: 'sub_1' } });

    expect(result).toMatchObject({ data: { id: 'sub_1', status: 'cancelled' } });
  });
});