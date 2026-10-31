import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B4-CBA-BENCHMARK-GET-WRITES-SNAPSHOT-NO-AUDIT: a GET with ?save=true inserted a snapshot with no audit. A read no longer writes; saving is POST,
// under platform authority, with the intent recorded before the write.
const m = vi.hoisted(() => ({
  findComparable: vi.fn(),
  save: vi.fn(),
  getAgreement: vi.fn(),
  getSnapshots: vi.fn(),
  requireSystemAdmin: vi.fn(),
  operation: vi.fn(),
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
vi.mock('@/lib/api-auth-guard', () => ({ requireSystemAdmin: () => m.requireSystemAdmin() }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: m.operation,
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
    m.getAgreement.mockResolvedValue({ id: 'a1' });
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

  it('POST records the intent before saving, and returns the snapshot id', async () => {
    const { POST } = await import('../cba-intelligence/benchmark/[id]/route');
    const result = await (POST as never as (c: unknown) => Promise<{ data: { snapshotId: string } }>)({ ...ctx, body: { sector: 'public' } });
    expect(m.operation).toHaveBeenCalledWith(expect.objectContaining({ action: 'cba_benchmark.snapshot', userId: 'u1', resourceId: 'a1' }), expect.any(Function));
    expect(result.data.snapshotId).toBe('s1');
  });

  it('POST saves nothing when the intent cannot be recorded', async () => {
    m.operation.mockRejectedValue(Object.assign(new Error('audit down'), { code: 'OPERATION_AUDIT_UNAVAILABLE' }));
    const { POST } = await import('../cba-intelligence/benchmark/[id]/route');
    await expect((POST as never as (c: unknown) => Promise<unknown>)({ ...ctx, body: {} })).rejects.toMatchObject({ status: 409 });
    expect(m.save).not.toHaveBeenCalled();
  });
});
