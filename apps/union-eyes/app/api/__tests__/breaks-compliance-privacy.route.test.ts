import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const ORG = '11111111-1111-4111-8111-111111111111';
const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  row: { reportingMembers: 5, total: 8, denied: 2, missed: 1, shortened: 1, taken: 4, flagged: 2 },
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: (msg: string) => new Error(msg) } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({ memberBreaks: { organizationId: 'organizationId', memberId: 'memberId', status: 'status', complianceFlag: 'complianceFlag' } }));
vi.mock('drizzle-orm', async (orig) => {
  const actual = await orig<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((column, value) => ({ column, value })) };
});

async function load() { return import('../breaks/compliance/route'); }

describe('break compliance privacy and audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.row = { reportingMembers: 5, total: 8, denied: 2, missed: 1, shortened: 1, taken: 4, flagged: 2 };
    m.withApi.mockImplementation((_config: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.select.mockImplementation(() => ({ from: m.from }));
    m.from.mockImplementation(() => ({ where: m.where }));
    m.where.mockImplementation(async () => [m.row]);
    m.withRLSContext.mockImplementation(async (_context: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({ select: m.select }));
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('returns organization aggregates without any member identifier or per-member grouping', async () => {
    const { GET } = await load();
    const result = await GET({ organizationId: ORG, userId: 'u1' });
    expect(result).toMatchObject({ scope: 'organization', suppressed: false, data: [{ scope: 'organization', reportingMembers: 5, total: 8, denied: 2 }] });
    expect(JSON.stringify(result)).not.toContain('memberId');
    expect(m.select.mock.calls[0][0]).not.toHaveProperty('memberId');
    expect(eq).toHaveBeenCalledWith('organizationId', ORG);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG, userId: 'u1' }, expect.any(Function));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: ORG, userId: 'u1', action: 'member.break.compliance.aggregate.read' }));
  });

  it('suppresses small cohorts instead of exposing individual break activity', async () => {
    m.row.reportingMembers = 4;
    const { GET } = await load();
    const result = await GET({ organizationId: ORG, userId: 'u1' });
    expect(result).toMatchObject({ suppressed: true, minimumCohortSize: 5, data: [] });
  });

  it('does not fabricate a compliance result when no reports exist', async () => {
    m.row.reportingMembers = 0;
    m.row.total = 0;
    const { GET } = await load();
    expect(await GET({ organizationId: ORG, userId: 'u1' })).toMatchObject({ suppressed: false, data: [], basis: 'member_self_reports_not_employer_verified' });
  });

  it('rejects missing organization or actor before querying', async () => {
    const { GET } = await load();
    await expect(GET({ organizationId: null, userId: 'u1' })).rejects.toThrow('Active organization');
    await expect(GET({ organizationId: ORG, userId: null })).rejects.toThrow('Active organization');
    expect(m.select).not.toHaveBeenCalled();
  });

  it('fails closed when read auditing cannot persist', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    const { GET } = await load();
    await expect(GET({ organizationId: ORG, userId: 'u1' })).rejects.toThrow('audit unavailable');
  });
});
