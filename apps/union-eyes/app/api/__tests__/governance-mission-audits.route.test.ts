import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/mission-audits/route');
}

describe('governance/mission-audits route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValueOnce([{ id: 'a1' }]).mockResolvedValueOnce(undefined as never);
  });

  it('lists mission audits', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toEqual({ audits: [{ id: 'a1' }] });
  });

  it('creates a mission audit', async () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1');
    const { POST } = await loadRoute();
    const result = await POST({ body: { auditYear: 2026, auditPeriodStart: '2026-01-01', auditPeriodEnd: '2026-01-31', auditorFirm: 'Firm', auditorName: 'Auditor', auditDate: '2026-01-31', unionRevenuePercent: 55, memberSatisfactionPercent: 75, dataViolations: 0 }, userId: 'u1', organizationId: 'org_1' });

    expect(result).toEqual({ id: 'uuid-1', overallPass: true });
    randomUuid.mockRestore();
  });
});