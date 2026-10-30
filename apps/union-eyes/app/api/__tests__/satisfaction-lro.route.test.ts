import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B11-IDS-SATISFACTION-REPRESENTATIVE-FIGURES-FOR-AN-UNKNOWN-OR-UNRATED-ID-ARE-200-WITH-ZERO-AVERAGES
const m = vi.hoisted(() => ({ getLroPerformance: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/lib/services/satisfaction-service', () => ({ getLroPerformance: m.getLroPerformance }));

describe('satisfaction/lro/[lroId] route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is a 404, not zero averages, for a representative with no completed surveys', async () => {
    m.getLroPerformance.mockResolvedValue({ lroId: 'x', totalSurveys: 0, completedSurveys: 0, overallAverage: 0, recommendRate: 0 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    await expect((GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'x' }, organizationId: 'org_1' })).rejects.toMatchObject({ status: 404 });
  });

  it('returns the figures, read within the caller\u2019s organization, when surveys exist', async () => {
    m.getLroPerformance.mockResolvedValue({ lroId: 'l1', totalSurveys: 3, completedSurveys: 3, overallAverage: 4.2, recommendRate: 100 });
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    const result = await (GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'l1' }, organizationId: 'org_1' });
    expect(result).toMatchObject({ lroId: 'l1', completedSurveys: 3, overallAverage: 4.2 });
    expect(m.getLroPerformance).toHaveBeenCalledWith('l1', 'org_1');
  });

  it('refuses a caller with no organization instead of reading every organization\u2019s surveys', async () => {
    const { GET } = await import('../satisfaction/lro/[lroId]/route');
    await expect((GET as never as (c: unknown) => Promise<unknown>)({ params: { lroId: 'l1' }, organizationId: null })).rejects.toMatchObject({ status: 400 });
    expect(m.getLroPerformance).not.toHaveBeenCalled();
  });
});
