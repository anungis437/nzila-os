import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/db/db', () => ({
  db: { execute: m.execute },
}));
vi.mock('drizzle-orm', () => ({ sql: (s: TemplateStringsArray) => s.join('') }));

async function loadRoute() {
  return import('../governance/dashboard/route');
}

describe('governance/dashboard route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<any>) => handler);
    m.withSystemContext.mockImplementation(async (fn: () => Promise<any>) => fn());
  });

  it('returns normalized dashboard payload when data exists', async () => {
    const { GET } = await loadRoute();
    m.execute
      .mockResolvedValueOnce([{ certificate_number: 'GS-1', consecutive_compliance_years: 2, sunset_clause_duration: 5 }])
      .mockResolvedValueOnce([{ id: 'v1', title: 'Vote 1', matter_type: 'budget', voting_deadline: '2026-01-01' }])
      .mockResolvedValueOnce([{ id: 'v2', title: 'Pending', matter_type: 'policy', voting_deadline: '2026-01-02' }])
      .mockResolvedValueOnce([{ id: 'a1', audit_year: 2025, auditor_firm: 'Audit Co', overall_pass: true }])
      .mockResolvedValueOnce([{ id: 'e1', title: 'Board election', event_date: '2026-02-01' }])
      .mockResolvedValueOnce([{ total_votes: 4, votes_approved: 3, votes_vetoed: 1, audits_passed: 2, audits_failed: 0 }]);

    const payload = await GET();

    expect(payload.goldenShare.share.certificateNumber).toBe('GS-1');
    expect(payload.goldenShare.sunsetProgress.percentComplete).toBe(40);
    expect(payload.recentVotes).toHaveLength(1);
    expect(payload.pendingVotes).toHaveLength(1);
    expect(payload.recentAudits).toHaveLength(1);
    expect(payload.recentEvents).toHaveLength(1);
    expect(payload.stats.totalVotes).toBe(4);
  });

  it('returns safe defaults when no golden share row exists', async () => {
    const { GET } = await loadRoute();
    m.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{}]);

    const payload = await GET();

    expect(payload.goldenShare).toBeNull();
    expect(payload.recentVotes).toEqual([]);
    expect(payload.pendingVotes).toEqual([]);
    expect(payload.recentAudits).toEqual([]);
    expect(payload.recentEvents).toEqual([]);
    expect(payload.stats).toMatchObject({
      totalVotes: 0,
      votesApproved: 0,
      votesVetoed: 0,
      auditsPassed: 0,
      auditsFailed: 0,
    });
  });
});
