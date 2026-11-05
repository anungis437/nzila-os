import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ summary: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({ withApi: (_config: unknown, handler: unknown) => handler }));
vi.mock('@/db/queries/deadline-queries', () => ({ getDeadlineDashboardSummary: m.summary }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD' },
  standardErrorResponse: (code: string, message: string) => Response.json({ code, message }, { status: 400 }),
}));

const SUMMARY = { activeDeadlines: 5, overdueCount: 1, dueSoonCount: 2, criticalCount: 1, avgDaysOverdue: 5, onTimePercentage: 33 };

describe('GET /api/deadlines/dashboard', () => {
  beforeEach(() => {
    m.summary.mockReset();
  });

  it("answers with the summary of the caller's organization", async () => {
    m.summary.mockResolvedValueOnce(SUMMARY);
    const { GET } = await import('../deadlines/dashboard/route');

    const response = await (GET as unknown as (ctx: unknown) => Promise<Response>)({ organizationId: 'org-1' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
    expect(m.summary).toHaveBeenCalledWith('org-1');
  });

  it('refuses a request that has no organization, without querying', async () => {
    const { GET } = await import('../deadlines/dashboard/route');

    const response = await (GET as unknown as (ctx: unknown) => Promise<Response>)({ organizationId: null });

    expect(response.status).toBe(400);
    expect(m.summary).not.toHaveBeenCalled();
  });

  it('fails when the query fails, instead of answering with zeroed counts', async () => {
    m.summary.mockRejectedValueOnce(new Error('relation "claim_deadlines" does not exist'));
    const { GET } = await import('../deadlines/dashboard/route');

    await expect((GET as unknown as (ctx: unknown) => Promise<Response>)({ organizationId: 'org-1' })).rejects.toThrow('claim_deadlines');
  });
});
