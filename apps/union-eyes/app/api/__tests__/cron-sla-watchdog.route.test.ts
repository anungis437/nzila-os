import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  pages: [] as unknown[][],
  pageCalls: 0,
  writeSlaAlerts: vi.fn(),
  rlsContexts: [] as unknown[],
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  recordUnionEyesSlaCompliance: vi.fn(),
  recordUnionEyesSlaWatchdog: vi.fn(),
}));

const chain = () => {
  const c: any = {
    from: () => c, where: () => c, orderBy: () => c,
    limit: async () => { m.pageCalls += 1; return m.pages.shift() ?? []; },
  };
  return c;
};

vi.mock('@/db/db', () => ({ db: { select: () => chain() } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (op: () => Promise<unknown>) => op(),
  withRLSContext: async (ctx: unknown, op: (tx: unknown) => Promise<unknown>) => { m.rlsContexts.push(ctx); return op({}); },
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/workflow/case-lifecycle', () => ({ getSLADeadlineHours: () => 10 }));
vi.mock('@/lib/workflow/state-bridge', () => ({ toLifecycleState: () => 'submitted' }));
vi.mock('@/lib/pilot-metrics', () => ({
  recordUnionEyesSlaCompliance: m.recordUnionEyesSlaCompliance,
  recordUnionEyesSlaWatchdog: m.recordUnionEyesSlaWatchdog,
}));
vi.mock('@/lib/api/framework', () => ({ withApi: (_: unknown, handler: () => Promise<unknown>) => handler }));
vi.mock('@/lib/workflow/sla-alerts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/workflow/sla-alerts')>()),
  writeSlaAlerts: m.writeSlaAlerts,
}));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
const row = (id: string, org: string | null, hours: number, assignedTo: string | null = 'steward') => ({
  claimId: id, claimNumber: `N-${id}`, status: 'open', priority: 'medium', organizationId: org, assignedTo, updatedAt: hoursAgo(hours), createdAt: hoursAgo(hours),
});

async function run() {
  const { POST } = await import('../cron/sla-watchdog/route');
  return (POST as any)() as Promise<Response>;
}

describe('cron/sla-watchdog route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.pages = [];
    m.pageCalls = 0;
    m.rlsContexts = [];
    m.writeSlaAlerts.mockImplementation(async (_tx: unknown, _org: string, alerts: unknown[]) => alerts.length);
    m.recordUnionEyesSlaCompliance.mockResolvedValue(undefined);
    m.recordUnionEyesSlaWatchdog.mockResolvedValue(undefined);
  });

  it('answers 200 with zero counts when there are no active claims', async () => {
    const response = await run();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, scanned: 0, alerts_written: 0 });
  });

  it('writes the alerts inside each organization\'s own context and reports the counts', async () => {
    m.pages = [[row('a', ORG_A, 9), row('b', ORG_A, 12), row('c', ORG_A, 1), row('d', ORG_B, 12), row('e', ORG_B, 12, null), row('f', null, 12)]];
    const body = await (await run()).json();
    expect(body).toMatchObject({ success: true, scanned: 6, at_risk: 1, breached: 3, alerts_written: 3, unassigned_claims: 1, claims_without_organization: 1 });
    expect(m.rlsContexts).toEqual([
      { organizationId: ORG_A, userId: 'system:sla-watchdog' },
      { organizationId: ORG_B, userId: 'system:sla-watchdog' },
    ]);
    expect(m.writeSlaAlerts.mock.calls.map((c) => [c[1], c[2].map((a: any) => a.claimId)])).toEqual([[ORG_A, ['a', 'b']], [ORG_B, ['d']]]);
  });

  it('assesses each claim once and keys the metrics by organization and hour', async () => {
    m.pages = [[row('a', ORG_A, 9)]];
    await run();
    expect(m.recordUnionEyesSlaWatchdog).toHaveBeenCalledTimes(1);
    expect(m.recordUnionEyesSlaWatchdog.mock.calls[0][3]).toMatch(new RegExp(`^sla-watchdog:${ORG_A}:\\d{4}-\\d{2}-\\d{2}T\\d{2}$`));
    expect(m.recordUnionEyesSlaCompliance.mock.calls[0][3]).toBe(m.recordUnionEyesSlaWatchdog.mock.calls[0][3]);
  });

  it('pages through every claim instead of reading them in one query', async () => {
    const full = Array.from({ length: 500 }, (_, i) => row(`c${String(i).padStart(4, '0')}`, ORG_A, 1));
    m.pages = [full, [row('z', ORG_A, 1)]];
    const body = await (await run()).json();
    expect(body.scanned).toBe(501);
    expect(m.pageCalls).toBe(2);
  });

  it('answers 500 naming the organization when its alerts cannot be written, and still reports the others', async () => {
    m.pages = [[row('a', ORG_A, 12), row('d', ORG_B, 12)]];
    m.writeSlaAlerts.mockRejectedValueOnce(new Error('db down'));
    const response = await run();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, failures: [{ scope: `alerts:${ORG_A}` }], alerts_written: 1 });
  });

  it('answers 500 when a metric cannot be recorded, instead of dropping it unseen', async () => {
    m.pages = [[row('a', ORG_A, 1)]];
    m.recordUnionEyesSlaCompliance.mockRejectedValueOnce(new Error('metrics down'));
    const response = await run();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ failures: [{ scope: `metrics:${ORG_A}` }] });
  });
});
