import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-FOR-AN-UNKNOWN-OR-UNRATED-ID-ARE-200-WITH-ZERO-AVERAGES
const m = vi.hoisted(() => ({ getLroPerformance: vi.fn(), hasMinRole: vi.fn(), audit: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/lib/services/satisfaction-service', () => ({ getLroPerformance: m.getLroPerformance }));
// Figures are read under the officer rule, with a minimum number of responses, and each read is audited (added later; disclosed).
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

describe('satisfaction/lro/[lroId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
    m.audit.mockResolvedValue(undefined);
  });

  it('is a 404, not zero averages, for a representative with no completed surveys', async () => {
    m.getLroPerformance.mockResolvedValue({ lroId: 'x', totalSurveys: 0, completedSurveys: 0, overallAverage: 0, recommendRate: 0 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    await expect((GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'x' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });
  });

  it('returns the figures, read within the caller\u2019s organization, when surveys exist', async () => {
    m.getLroPerformance.mockResolvedValue({ lroId: 'l1', totalSurveys: 6, completedSurveys: 6, overallAverage: 4.2, recommendRate: 100 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    const result = await (GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'l1' }, organizationId: 'org_1', userId: 'u1' });
    expect(result).toMatchObject({ lroId: 'l1', completedSurveys: 6, overallAverage: 4.2 });
    expect(m.getLroPerformance).toHaveBeenCalledWith('l1', 'org_1');
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'satisfaction.representative.read', details: { representativeId: 'l1', completedSurveys: 6 } }));
  });

  it('shows the count and no averages below the minimum number of responses', async () => {
    m.getLroPerformance.mockResolvedValue({ lroId: 'l1', totalSurveys: 2, completedSurveys: 2, overallAverage: 5, recommendRate: 100 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    const result = await (GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'l1' }, organizationId: 'org_1', userId: 'u1' });
    expect(result).toEqual({ lroId: 'l1', completedSurveys: 2, minimumResponses: 5, figures: null });
  });

  it('lets a steward read their own figures but not another representative\'s', async () => {
    m.hasMinRole.mockResolvedValue(false);
    m.getLroPerformance.mockResolvedValue({ lroId: 'u1', totalSurveys: 6, completedSurveys: 6, overallAverage: 4, recommendRate: 90 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    const call = (lroId: string) => (GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId }, organizationId: 'org_1', userId: 'u1' });
    await expect(call('u1')).resolves.toMatchObject({ lroId: 'u1' });
    await expect(call('someone-else')).rejects.toMatchObject({ status: 403 });
    expect(m.getLroPerformance).toHaveBeenCalledTimes(1);
  });

  it('refuses a caller with no organization instead of reading every organization\u2019s surveys', async () => {
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    await expect((GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'l1' }, organizationId: null, userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(m.getLroPerformance).not.toHaveBeenCalled();
  });
});
