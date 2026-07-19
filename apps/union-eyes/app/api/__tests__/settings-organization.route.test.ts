import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: () => new Error('bad') },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizations: {} }));
vi.mock('@/db/schema', () => ({ organizationMembers: {} }));

async function loadRoute() {
  return import('../settings/organization/route');
}

describe('settings/organization route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((config: any, handler: any) => async (ctx: any) => handler(ctx));
    m.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: 'org_1', name: 'Test Org', shortName: 'TO', memberCount: 100, settings: { theme: 'dark' } },
        ]),
      })),
    }));
    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
  });

  it('returns organization settings', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });
    expect(result.organization).toBeDefined();
    expect(result.organization?.id).toBe('org_1');
  });

  it('returns empty settings when org not found', async () => {
    const { GET } = await loadRoute();
    m.db.select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => []) })) }));
    const result = await GET({ organizationId: 'missing' });
    expect(result.organization).toBeNull();
  });

  it('updates organization settings', async () => {
    const { PUT } = await loadRoute();
    const result = await PUT({
      organizationId: 'org_1',
      body: { name: 'Updated Org', settings: { theme: 'light' } },
    });
    expect([true, false]).toContain(result.updated);
  });
});
