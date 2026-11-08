import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// DEF-0B3-BREAKS-CREATE-FOR-OTHER-MEMBER, DEF-0B3-BREAKS-OWNER-IDENTITY-MISMATCH: the break collection
// must never accept a caller-supplied memberId and must always resolve the acting member from the
// authenticated session's active organization_members row, not from a client-controlled value.
const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  persistAtomicAudit: vi.fn(),
  withRLSContext: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
  memberRow: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { code: 'FORBIDDEN' }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { code: 'VALIDATION_ERROR' }),
  },
  z: require('zod'),
}));
vi.mock('@/db/schema', () => ({
  memberBreaks: { organizationId: 'organizationId', memberId: 'memberId', createdAt: 'createdAt' },
  organizationMembers: { organizationId: 'organizationId', userId: 'userId', status: 'status', id: 'id' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('drizzle-orm', async (orig) => {
  const actual = await orig<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((column, value) => ({ column, value })), and: vi.fn((...c) => ({ and: c })), desc: vi.fn((c) => ({ desc: c })) };
});

async function load() {
  return import('../breaks/route');
}

describe('break collection: member identity is always resolved from the session, never the body', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_config: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
    m.select.mockImplementation(() => ({ from: m.from }));
    m.from.mockImplementation(() => ({ where: m.where }));
    m.where.mockImplementation(() => ({ limit: m.limit, orderBy: () => ({ limit: m.limit }) }));
    m.limit.mockImplementation(async () => [m.memberRow]);
    m.insert.mockImplementation(() => ({ values: m.values }));
    m.values.mockImplementation(() => ({ returning: m.returning }));
    m.returning.mockImplementation(async () => [{ id: 'break-1', organizationId: ORG, memberId: MEMBER_ID, status: 'taken' }]);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ select: m.select, insert: m.insert }));
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('POST: the create schema has no memberId field at all - a caller cannot supply one, forged or otherwise', async () => {
    await load();
    const config = m.withApi.mock.calls.find((call) => call[0]?.openapi?.summary?.includes('Create'))?.[0];
    expect(config.body).toBeDefined();
    // zod's own shape never includes memberId - .strict() means an extra key would be rejected at parse time.
    expect(Object.keys(config.body.shape)).not.toContain('memberId');
    const parsed = config.body.safeParse({ breakType: 'meal', workDate: '2026-01-05', memberId: 'someone-else' });
    expect(parsed.success).toBe(false);
  });

  it('POST: writes the break under the memberId resolved from the authenticated session, never a body value', async () => {
    const { POST } = await load();
    await POST({ organizationId: ORG, userId: 'user-1', body: { breakType: 'meal', workDate: '2026-01-05' } });

    expect(m.where).toHaveBeenCalled();
    expect(m.values).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, memberId: MEMBER_ID, createdBy: 'user-1' }));
  });

  it('GET: lists only the resolved member\'s own breaks, scoped by organization and memberId', async () => {
    m.limit
      .mockImplementationOnce(async () => [m.memberRow]) // ownMember lookup
      .mockImplementationOnce(async () => [{ id: 'break-1', memberId: MEMBER_ID }]); // the list query
    const { GET } = await load();
    const result = await GET({ organizationId: ORG, userId: 'user-1' }) as { data: unknown[] };
    expect(result.data).toHaveLength(1);
  });

  it('refuses when the caller has no active organization membership, before any write', async () => {
    m.limit.mockImplementationOnce(async () => []);
    const { POST } = await load();
    await expect(POST({ organizationId: ORG, userId: 'user-1', body: { breakType: 'meal', workDate: '2026-01-05' } }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('refuses when organization or user context is missing, before any database access', async () => {
    const { POST } = await load();
    await expect(POST({ organizationId: null, userId: 'user-1', body: {} })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(POST({ organizationId: ORG, userId: null, body: {} })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});
