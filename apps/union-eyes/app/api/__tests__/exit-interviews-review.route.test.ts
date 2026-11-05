import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
  normalizeRole: vi.fn((role: string) => role),
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_o: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.db) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema', () => ({ exitInterviews: { id: 'id', organizationId: 'organizationId' }, exitInterviewEvents: {} }));
vi.mock('@/lib/api-auth-guard', () => ({ ROLE_HIERARCHY: { member: 1, officer: 2, admin: 3 }, normalizeRole: m.normalizeRole }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../exit-interviews/[id]/review/route');
}

describe('exit-interviews/[id]/review route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })) } as any);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'ei_1', status: 'reviewed' }]) })) })) } as any);
    m.db.insert.mockReturnValue({ values: vi.fn(async () => undefined) } as any);
    m.normalizeRole.mockImplementation((role: string) => role);
    m.audit.mockResolvedValue(undefined);
  });

  it('rejects non-officer users', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1', user: { role: 'member' }, body: {} })).rejects.toMatchObject({ status: 403 });
  });

  it('marks an interview as reviewed', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'submitted' }]) })) })) } as any);
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1', user: { role: 'officer' }, body: { notes: 'ok' } });

    expect(result).toEqual({ data: { id: 'ei_1', status: 'reviewed' } });
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'exit_interview.review', userId: 'u1' }));
  });

  it('refuses the author reviewing their own interview and writes nothing', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'submitted', createdBy: 'u1' }]) })) })) } as any);
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u1', user: { role: 'officer' }, body: {} })).rejects.toMatchObject({ status: 403 });
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('is a conflict with no audit when the interview was reviewed in the meantime', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'ei_1', status: 'submitted', createdBy: 'author' }]) })) })) } as any);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })) } as any);
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'ei_1' }, organizationId: 'org_1', userId: 'u2', user: { role: 'officer' }, body: {} })).rejects.toMatchObject({ status: 409 });
    expect(m.audit).not.toHaveBeenCalled();
  });
});