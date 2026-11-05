import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
  auditDataMutation: vi.fn(),
  sqlTemplate: vi.fn((..._parts: unknown[]) => 'sql'),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(m.sqlTemplate, { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/reserved-matters/route');
}

describe('governance/reserved-matters route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditDataMutation.mockResolvedValue(undefined);
    m.db.execute.mockResolvedValue([{ id: 'vote_1' }]);
  });

  it('lists votes', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toEqual({ votes: [{ id: 'vote_1' }] });
  });

  it('creates a reserved matter vote', async () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1');
    const { POST } = await loadRoute();
    const result = await POST({
      body: { matterType: 'policy', title: 'Matter', description: 'Desc', proposedBy: 'u1', votingDeadline: '2026-12-31T17:00:00Z' },
      userId: 'u1',
      organizationId: 'org_1',
    });

    expect(result).toEqual({ id: 'uuid-1' });
    expect(m.auditDataMutation).toHaveBeenCalled();
    randomUuid.mockRestore();
  });

  it('states the proposal date and the deadline, both NOT NULL columns, in the INSERT', async () => {
    const { POST } = await loadRoute();
    await POST({
      body: { matterType: 'policy', title: 'Matter', description: 'Desc', votingDeadline: '2026-12-31T17:00:00Z' },
      userId: 'u1',
      organizationId: 'org_1',
    });

    const statement = (m.sqlTemplate.mock.calls[0]?.[0] as readonly string[]).join('?');
    expect(statement).toMatch(/INSERT INTO reserved_matter_votes \([^)]*\bproposed_date\b[^)]*\bvoting_deadline\b/s);
  });
});