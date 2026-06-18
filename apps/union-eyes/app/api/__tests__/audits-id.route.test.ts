import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema/audit-security-schema', () => ({ auditLogs: { auditId: 'auditId', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../audits/[id]/route');
}

describe('audits/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ auditId: 'a1', action: 'viewed' }]) })) })) } as any);
  });

  it('returns an audit log row', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 'a1' }, organizationId: 'org_1' });

    expect(result).toEqual({ auditId: 'a1', action: 'viewed' });
  });
});