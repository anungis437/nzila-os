import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  audit: vi.fn(),
  interview: [] as unknown[],
  returning: [] as unknown[],
  inserted: [] as Record<string, unknown>[],
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => {
  const err = (status: number) => (msg: string) => Object.assign(new Error(msg), { status });
  return {
    withApi: m.withApi,
    z: require('zod').z,
    ApiError: { badRequest: err(400), forbidden: err(403), notFound: err(404), conflict: err(409) },
  };
});
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_o: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.db) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema', () => ({
  exitInterviews: { id: 'id', organizationId: 'o', status: 'status', createdBy: 'createdBy' },
  exitInterviewEvents: {},
  exitInterviewDocuments: { interviewId: 'i', organizationId: 'o' },
}));
vi.mock('@/lib/api-auth-guard', () => ({
  ROLE_HIERARCHY: { member: 1, steward: 2, admin: 3 },
  normalizeRole: (r: string) => r,
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), asc: vi.fn(), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

const ctx = { params: { id: 'iv1' }, organizationId: 'org_1', userId: 'u1', user: { role: 'steward' } };

describe('exit-interview mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted = [];
    m.interview = [{ id: 'iv1', status: 'draft', createdBy: 'u1' }];
    m.returning = [{ id: 'iv1', status: 'submitted' }];
    m.audit.mockResolvedValue(undefined);
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.db.select.mockImplementation(() => {
      const chain: any = { from: () => chain, where: () => chain, limit: async () => m.interview, orderBy: async () => [{ id: 'd1' }], then: (resolve: (v: unknown) => void) => resolve([{ id: 'd1' }]) };
      return chain;
    });
    m.db.update.mockReturnValue({ set: () => ({ where: () => ({ returning: async () => m.returning }) }) });
    m.db.insert.mockReturnValue({
      values: (v: Record<string, unknown>) => {
        m.inserted.push(v);
        return { returning: async () => [{ id: 'new1', status: 'draft', ...v }] };
      },
    });
  });

  it('submit commits status, event and audit together, and only from draft', async () => {
    const { POST } = await import('../exit-interviews/[id]/submit/route');
    await (POST as any)(ctx);
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'exit_interview.submit', userId: 'u1' }));

    m.audit.mockClear();
    m.returning = [];
    await expect((POST as any)(ctx)).rejects.toMatchObject({ status: 409 });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('create records the draft, its event and its audit together', async () => {
    const { POST } = await import('../exit-interviews/route');
    await (POST as any)({
      organizationId: 'org_1',
      userId: 'u1',
      body: { retiringEmployeeName: 'Jane', roleInUnion: 'steward', yearsOfService: 10, retirementReason: 'retirement', title: 'Interview', keyLessons: 'Lessons learned' },
    });
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'exit_interview.create', organizationId: 'org_1' }));
  });

  describe('documents', () => {
    const body = { title: 'Transcript', fileUrl: 'https://nzilacanadastore.blob.core.windows.net/x.pdf', mimeType: 'application/pdf' };

    it('attaches to a draft and audits', async () => {
      const { POST } = await import('../exit-interviews/[id]/documents/route');
      await (POST as any)({ ...ctx, body });
      expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'exit_interview.document_attach' }));
    });

    it('does not alter a published interview', async () => {
      m.interview = [{ id: 'iv1', status: 'published', createdBy: 'u1' }];
      const { POST } = await import('../exit-interviews/[id]/documents/route');
      await expect((POST as any)({ ...ctx, body })).rejects.toMatchObject({ status: 409 });
      expect(m.audit).not.toHaveBeenCalled();
    });

    it.each(['https://evillocalhost/x.pdf', 'https://nzilacanadastore.blob.core.windows.net.evil.example/x.pdf'])(
      'rejects a look-alike storage host (%s)',
      async (fileUrl) => {
        const { POST } = await import('../exit-interviews/[id]/documents/route');
        await expect((POST as any)({ ...ctx, body: { ...body, fileUrl } })).rejects.toMatchObject({ status: 400 });
        expect(m.audit).not.toHaveBeenCalled();
      },
    );

    it("keeps a draft's attachments from members who are neither its owner nor steward-level", async () => {
      m.interview = [{ id: 'iv1', status: 'draft', createdBy: 'someone-else' }];
      const { GET } = await import('../exit-interviews/[id]/documents/route');
      await expect((GET as any)({ ...ctx, user: { role: 'member' } })).rejects.toMatchObject({ status: 403 });
      await expect((GET as any)({ ...ctx, user: { role: 'steward' } })).resolves.toMatchObject({ data: [{ id: 'd1' }] });
    });

    it('shows a published interview\'s attachments to any member', async () => {
      m.interview = [{ id: 'iv1', status: 'published', createdBy: 'someone-else' }];
      const { GET } = await import('../exit-interviews/[id]/documents/route');
      await expect((GET as any)({ ...ctx, user: { role: 'member' } })).resolves.toMatchObject({ data: [{ id: 'd1' }] });
    });
  });
});
