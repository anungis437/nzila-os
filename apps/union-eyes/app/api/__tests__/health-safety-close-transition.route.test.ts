import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  updated: [] as Array<Record<string, unknown>>,
  existing: [] as Array<Record<string, unknown>>,
  setValues: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  z: { object: () => ({ strict: () => ({}) }), enum: () => ({}) },
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
    notFound: (message: string) => Object.assign(new Error(`${message} not found`), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      update: () => ({ set: (values: Record<string, unknown>) => { m.setValues.push(values); return { where: () => ({ returning: async () => m.updated }) }; } }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => m.existing }) }) }),
    }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(), eq: vi.fn(), inArray: vi.fn() };
});
vi.mock('@/db/schema', () => ({
  workplaceIncidents: { id: 'id', status: 'status', organizationId: 'organizationId', closedDate: 'closedDate', investigationCompletedDate: 'investigationCompletedDate' },
  hazardReports: { id: 'id', status: 'status', organizationId: 'organizationId', resolutionDate: 'resolutionDate', closedDate: 'closedDate' },
}));

const ctx = (over: Record<string, unknown> = {}) => ({ params: { id: 'rec-1' }, organizationId: 'org-1', userId: 'admin-1', body: { action: 'resolve' }, ...over });
const close = async (c: unknown) => (await import('../health-safety/incidents/[id]/close/route')).POST(c as never) as Promise<Record<string, unknown>>;
const transition = async (c: unknown) => (await import('../health-safety/hazards/[id]/transition/route')).POST(c as never) as Promise<Record<string, unknown>>;

describe('health-safety close and transition routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updated = [{ id: 'rec-1', status: 'closed' }];
    m.existing = [];
    m.setValues.length = 0;
    m.audit.mockResolvedValue(undefined);
  });

  it('closes an open incident, stamps the dates from the database clock and audits it', async () => {
    const result = await close(ctx());
    expect(result.id).toBe('rec-1');
    expect(m.setValues[0]).toMatchObject({ status: 'closed' });
    expect(m.setValues[0].closedDate).toBeDefined();
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'incident.close', organizationId: 'org-1' }));
  });

  it('refuses to close an incident already closed, one that does not exist and one in no organization', async () => {
    m.updated = [];
    m.existing = [{ status: 'closed' }];
    await expect(close(ctx())).rejects.toMatchObject({ status: 409 });
    m.existing = [];
    await expect(close(ctx())).rejects.toMatchObject({ status: 404 });
    await expect(close(ctx({ organizationId: null }))).rejects.toMatchObject({ status: 403 });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('resolves a hazard with a resolution date and closes it with a closed date too', async () => {
    m.updated = [{ id: 'rec-1', status: 'resolved' }];
    await transition(ctx());
    expect(m.setValues[0]).toMatchObject({ status: 'resolved' });
    expect(m.setValues[0].closedDate).toBeUndefined();
    await transition(ctx({ body: { action: 'close' } }));
    expect(m.setValues[1]).toMatchObject({ status: 'closed' });
    expect(m.setValues[1].closedDate).toBeDefined();
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'hazard.close' }));
  });

  it('refuses a hazard transition from a state that does not allow it', async () => {
    m.updated = [];
    m.existing = [{ status: 'closed' }];
    await expect(transition(ctx({ body: { action: 'resolve' } }))).rejects.toMatchObject({ status: 409 });
    expect(m.audit).not.toHaveBeenCalled();
  });
});
