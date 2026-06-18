import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) }, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ kpiConfigurations: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../targets/[id]/route');
}

describe('targets/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 't1', isActive: true }]) })),
      })),
    });
  });

  it('updates the target active state', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH({ body: { isActive: true }, organizationId: 'org_1', params: { id: 't1' } });

    expect(result).toEqual({ id: 't1', isActive: true });
  });
});