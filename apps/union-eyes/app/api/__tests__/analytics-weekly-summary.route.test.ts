import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  dbExecute: vi.fn(),
  dbInsert: vi.fn(),
  auditAIInvocation: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ADVANCED_ANALYTICS: { requests: 50, window: 60 } },
  ApiError: {
    badRequest: (message: string) => new Error(message),
  },
}));
vi.mock('@/db', () => ({
  db: {
    execute: m.dbExecute,
    insert: m.dbInsert,
  },
}));
vi.mock('@/db/schema', () => ({ insightRecommendations: {} }));
vi.mock('@/lib/audit-logger', () => ({
  auditAIInvocation: m.auditAIInvocation,
  auditLog: m.auditLog,
  AuditEventType: { DATA_CREATE: 'DATA_CREATE' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', () => ({ sql: vi.fn(() => 'sql') }));

async function loadRoute() {
  return import('../analytics/insights/weekly-summary/route');
}

describe('analytics/insights/weekly-summary route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditAIInvocation.mockResolvedValue('ai_ref_1');
    m.auditLog.mockResolvedValue(undefined);
    m.dbInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: 'insight_1' }]),
      })),
    });
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ userId: 'user_1' })).rejects.toThrow('Organization context required');
  });

  it('returns a synthesized weekly summary when friction points exist', async () => {
    const { POST } = await loadRoute();
    m.dbExecute
      .mockResolvedValueOnce([
        {
          total_events: 40,
          sessions_started: 10,
          cases_created: 6,
          documents_uploaded: 8,
          active_users: 7,
        },
      ])
      .mockResolvedValueOnce([
        { category: 'onboarding', cnt: 5, avg_rating: '2.50' },
        { category: 'support', cnt: 3, avg_rating: '3.20' },
      ]);

    const result = await POST({ organizationId: 'org_1', userId: 'user_1' });

    expect(result.window).toBe('7d');
    expect(result.engagement).toMatchObject({ totalEvents: 40, activeUsers: 7, sessionsStarted: 10, engagementScore: 70 });
    expect(result.topFrictionPoints).toHaveLength(2);
    expect(result.recommendations[0]).toContain('onboarding');
    expect(result.insightId).toBe('insight_1');
    expect(m.auditAIInvocation).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org_1', userId: 'user_1' }));
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'weekly_insight_generated' }));
  });

  it('uses the fallback recommendation when no friction points are returned', async () => {
    const { POST } = await loadRoute();
    m.dbExecute
      .mockResolvedValueOnce([
        {
          total_events: 0,
          sessions_started: 0,
          cases_created: 0,
          documents_uploaded: 0,
          active_users: 0,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await POST({ organizationId: 'org_2', userId: 'user_2' });

    expect(result.topFrictionPoints).toEqual([]);
    expect(result.recommendations[0]).toContain('No critical friction spikes detected');
    expect(m.dbInsert).toHaveBeenCalled();
  });
});