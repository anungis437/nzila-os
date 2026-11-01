import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B4-CBA-BENCHMARK-GET-WRITES-SNAPSHOT-NO-AUDIT: a GET with ?save=true inserted a snapshot with no audit. A read no longer writes; saving is POST,
// under platform authority, with the audit record written in the snapshot's own transaction.
const m = vi.hoisted(() => ({
  findComparable: vi.fn(),
  save: vi.fn(),
  getAgreement: vi.fn(),
  getSnapshots: vi.fn(),
  requireSystemAdmin: vi.fn(),
  operation: vi.fn(),
  isPlatformAdmin: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  z: require('zod'),
  ApiError: {
    notFound: (r: string) => Object.assign(new Error(r), { status: 404 }),
    unauthorized: (r: string) => Object.assign(new Error(r), { status: 401 }),
    conflict: (r: string) => Object.assign(new Error(r), { status: 409 }),
  },
}));
vi.mock('@/lib/api-auth-guard', () => ({ requireSystemAdmin: () => m.requireSystemAdmin(), isPlatformAdminUser: (id: string) => m.isPlatformAdmin(id) }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAtomicAuditedOperation: m.operation,
  operationAuditResponse: (e: unknown) => ((e as { code?: string })?.code === 'OPERATION_AUDIT_UNAVAILABLE' ? { status: 409, body: { error: { message: 'not performed' } } } : null),
}));
vi.mock('@/lib/services/cba-intelligence/benchmark-service', () => ({
  findComparableAgreements: m.findComparable,
  saveBenchmarkSnapshot: m.save,
  getBenchmarkSnapshots: m.getSnapshots,
}));
vi.mock('@/lib/services/cba-intelligence/extraction-service', () => ({ getAgreementById: m.getAgreement }));

const ctx = { params: { id: 'a1' }, userId: 'u1', organizationId: 'org-1' };

describe('cba-intelligence/benchmark/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireSystemAdmin.mockResolvedValue(undefined);
    m.isPlatformAdmin.mockResolvedValue(false);
    m.getAgreement.mockResolvedValue({ id: 'a1', reviewStatus: 'approved' });
    m.getSnapshots.mockResolvedValue([]);
    m.findComparable.mockResolvedValue({ targetAgreementId: 'a1', comparableCount: 2, comparables: [] });
    m.save.mockResolvedValue({ id: 's1' });
    m.operation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
  });

  it('GET computes and returns a benchmark and never saves one', async () => {
    const { GET } = await import('../cba-intelligence/benchmark/[id]/route');
    const result = await (GET as never as (c: unknown) => Promise<{ data: unknown }>)({ ...ctx, query: {} });
    expect(result.data).toMatchObject({ comparableCount: 2 });
    expect(m.save).not.toHaveBeenCalled();
  });

  // DEF-0B4-CBA-INTEL-SHARED-DATASET-NO-TENANT-PREDICATE: an organization's steward holds a role floor, not authority over the platform's review queue.
  it('GET shows the benchmark or the saved history of an unapproved agreement only to platform staff, and to everyone else it does not exist', async () => {
    const { GET } = await import('../cba-intelligence/benchmark/[id]/route');
    const read = (query: Record<string, unknown>) => (GET as never as (c: unknown) => Promise<{ data: unknown }>)({ ...ctx, query });
    m.getAgreement.mockResolvedValue({ id: 'a1', reviewStatus: 'pending_review' });
    for (const query of [{}, { history: true }]) {
      await expect(read(query)).rejects.toMatchObject({ status: 404 });
    }
    expect(m.findComparable).not.toHaveBeenCalled();
    expect(m.getSnapshots).not.toHaveBeenCalled();
    m.isPlatformAdmin.mockResolvedValue(true);
    expect((await read({})).data).toMatchObject({ comparableCount: 2 });
    expect((await read({ history: true })).data).toEqual([]);
    m.getAgreement.mockResolvedValue(null);
    await expect(read({})).rejects.toMatchObject({ status: 404 });
  });

  it('GET refuses a query that still asks it to save', async () => {
    const mod = await import('../cba-intelligence/benchmark/[id]/route');
    const schemaSource = (await import('node:fs')).readFileSync(new URL('../cba-intelligence/benchmark/[id]/route.ts', import.meta.url), 'utf8');
    expect(schemaSource).toMatch(/save: z\.undefined\(/);
    expect(mod.GET).toBeTypeOf('function');
  });

  it('POST requires a platform administrator before anything is computed or written', async () => {
    m.requireSystemAdmin.mockRejectedValue(Object.assign(new Error('System administrator privileges required'), { status: 403 }));
    const { POST } = await import('../cba-intelligence/benchmark/[id]/route');
    await expect((POST as never as (c: unknown) => Promise<unknown>)({ ...ctx, body: {} })).rejects.toMatchObject({ status: 403 });
    expect(m.operation).not.toHaveBeenCalled();
    expect(m.save).not.toHaveBeenCalled();
  });

  it('POST saves and audits in one system-scope transaction, and returns the snapshot id', async () => {
    const { POST } = await import('../cba-intelligence/benchmark/[id]/route');
    const result = await (POST as never as (c: unknown) => Promise<{ data: { snapshotId: string } }>)({ ...ctx, body: { sector: 'public' } });
    expect(m.operation).toHaveBeenCalledWith(expect.objectContaining({ action: 'cba_benchmark.snapshot', userId: 'u1', resourceId: 'a1', scope: 'system' }), expect.any(Function));
    expect(m.operation.mock.calls[0][0].resultDetails({ data: { snapshotId: 's1', comparableCount: 2 } })).toEqual({ snapshotId: 's1', comparableCount: 2 });
    expect(result.data.snapshotId).toBe('s1');
  });

  it('POST saves nothing when the audit record cannot be written', async () => {
    m.operation.mockRejectedValue(Object.assign(new Error('audit down'), { code: 'OPERATION_AUDIT_UNAVAILABLE' }));
    const { POST } = await import('../cba-intelligence/benchmark/[id]/route');
    await expect((POST as never as (c: unknown) => Promise<unknown>)({ ...ctx, body: {} })).rejects.toMatchObject({ status: 409 });
    expect(m.save).not.toHaveBeenCalled();
  });
});
