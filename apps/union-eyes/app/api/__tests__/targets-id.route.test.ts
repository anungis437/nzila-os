import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  tx: { update: vi.fn() },
  persistAtomicAudit: vi.fn(),
  returned: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
  z: require('zod'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({ kpiConfigurations: { id: 'id', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and') };
});

async function loadRoute() {
  return import('../targets/[id]/route');
}

const ctx = { body: { isActive: true }, organizationId: 'org_1', userId: 'u1', params: { id: '11111111-1111-4111-8111-111111111111' } };

describe('targets/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.returned = [{ id: '11111111-1111-4111-8111-111111111111', isActive: true }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (c: any) => handler(c));
    m.tx.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => m.returned) })),
      })),
    });
  });

  it('updates the target active state and audits it on the same transaction', async () => {
    const { PATCH } = await loadRoute();
    const result = await PATCH(ctx);

    expect(result).toEqual({ id: '11111111-1111-4111-8111-111111111111', isActive: true });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'target.activate', resourceId: '11111111-1111-4111-8111-111111111111' }),
    );
  });

  it('rejects malformed target ids without querying or auditing', async () => {
    const { PATCH } = await loadRoute();
    await expect(PATCH({ ...ctx, params: { id: 'not-a-uuid' } })).rejects.toMatchObject({ status: 400 });
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers 404 and writes no audit when the target is not in the caller\u2019s organization', async () => {
    const { PATCH } = await loadRoute();
    m.returned = [];

    await expect(PATCH(ctx)).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the update when its audit cannot be written', async () => {
    const { PATCH } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(PATCH(ctx)).rejects.toThrow('audit unavailable');
  });
});
