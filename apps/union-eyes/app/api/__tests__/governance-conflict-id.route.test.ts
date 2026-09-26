import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { update: vi.fn() },
  updatedValues: [] as Record<string, unknown>[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ policyConflicts: { id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/conflicts/[conflictId]/route');
}

describe('governance/lifecycle/conflicts/[conflictId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.updatedValues = [];
    m.db.update.mockReturnValue({
      set: vi.fn((values: Record<string, unknown>) => {
        m.updatedValues.push(values);
        return { where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'c1', isActive: false }]) })) };
      }),
    } as any);
  });

  it('resolves a conflict', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH({ request: { json: async () => ({ resolutionNotes: 'resolved' }) }, params: { conflictId: 'c1' }, user: { id: 'u1' } });

    expect(result).toEqual({ conflict: { id: 'c1', isActive: false } });
    expect(m.updatedValues[0]?.resolvedBy).toBe('u1');
    expect(m.updatedValues[0]?.resolvedBy).not.toBe('system');
  });

  it('PATCH rejects a missing user and does not stamp a system actor', async () => {
    const { PATCH } = await loadRoute();

    await expect(PATCH({
      request: { json: async () => ({ resolutionNotes: 'resolved' }) },
      params: { conflictId: 'c1' },
      user: null,
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.updatedValues).toHaveLength(0);
  });

  it('PATCH rejects a user without an id and does not write', async () => {
    const { PATCH } = await loadRoute();

    await expect(PATCH({
      request: { json: async () => ({ resolutionNotes: 'resolved' }) },
      params: { conflictId: 'c1' },
      user: { id: '' },
    })).rejects.toMatchObject({ status: 400 });

    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});