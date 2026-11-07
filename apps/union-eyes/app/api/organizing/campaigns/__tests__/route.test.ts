import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  // withRLSContext calls platform auth() (re-exported by api-auth-guard).
  // Mocking auth on the guard does not reach that binding: importOriginal
  // loads the guard, which loads with-rls-context, which binds the platform
  // stub before the guard mock returns. Inject the session on the platform
  // module withRLSContext actually calls.
  platformAuth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  getUserRole: vi.fn(),
  checkRateLimit: vi.fn(),
  dbInsert: vi.fn(),
  dbSelect: vi.fn(),
  dbExecute: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.platformAuth,
  currentUser: async () => null,
  getAuth: m.platformAuth,
  authMiddleware: () => async () => {},
  createRouteMatcher: () => () => false,
}));
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: m.getCurrentUser };
});
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
}));
vi.mock('@/lib/auth/rbac-server', () => ({ getUserRole: m.getUserRole }));
vi.mock('@/lib/rate-limiter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limiter')>();
  return { ...actual, checkRateLimit: m.checkRateLimit };
});
vi.mock('@/db/db', () => ({
  db: {
    insert: m.dbInsert,
    select: m.dbSelect,
    execute: m.dbExecute,
    // Real withRLSContext opens a transaction and set_config()s on tx.execute
    // before running the handler. The fake client must provide that boundary;
    // the handler still queries through the module-level insert/select mocks.
    transaction: async (fn: (tx: { execute: typeof m.dbExecute; insert: typeof m.dbInsert; select: typeof m.dbSelect }) => Promise<unknown>) =>
      fn({ execute: m.dbExecute, insert: m.dbInsert, select: m.dbSelect }),
  },
}));
// The durable audit write is proven against real PostgreSQL elsewhere.
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  // Wrap (not replace) the real eq() so WHERE-clause construction behaves
  // identically to production while letting tests assert exactly which
  // column/value pairs were used to scope a query.
  return { ...actual, eq: vi.fn(actual.eq) };
});

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-1';

function authUser(role: string, organizationId: string = ORG_A) {
  return {
    id: USER_ID,
    email: null,
    name: null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    legacyTenantId: null,
    role,
    organizationId,
    metadata: {},
  };
}

/** Captures the exact object passed to db.insert(table).values(...). */
function mockInsertCapture() {
  let captured: Record<string, unknown> | undefined;
  m.dbInsert.mockImplementation(() => ({
    values: (v: Record<string, unknown>) => {
      captured = v;
      return { returning: async () => [{ id: 'new-record-id', ...v }] };
    },
  }));
  return () => captured;
}

function postRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 0, limit: 1000 });
  // Simulate a real DB-role lookup failure/absence so the metadata role from
  // getCurrentUser() is what actually governs the test outcome.
  m.getUserRole.mockResolvedValue(null);
  m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
  m.dbExecute.mockResolvedValue([]);
  m.platformAuth.mockImplementation(async () => {
    const user = await m.getCurrentUser();
    if (!user?.id) return { userId: null, orgId: null, sessionClaims: null, has: () => false };
    return {
      userId: user.id,
      orgId: user.organizationId ?? null,
      sessionClaims: null,
      has: () => false,
    };
  });
});

// DEF-0B10-ORG-CAMPAIGN-CODE-UNIQUE-ACROSS-ALL-ORGANIZATIONS-AND-REQUIRED-COLUMNS-FAIL-AS-500
// Through the real crud factory and withApi stack: the code is the server's and is drawn from the caller organization's own
// sequence, and a body without a required fact is a 400 that names it before any insert.
const URL_ = 'http://localhost/api/organizing/campaigns';
const COMPLETE = { campaignName: 'Warehouse drive', targetEmployer: 'Acme Logistics', workplaceLocation: 'Dock 4, Laval', estimatedUnitSize: 120 };

describe('POST /api/organizing/campaigns', () => {
  it('issues the next code of the caller organization, read under a per-organization lock, and never reads another organization', async () => {
    const { POST } = await import('../route');
    m.getCurrentUser.mockResolvedValue(authUser('officer'));
    m.dbExecute.mockImplementation(async (query: unknown) => {
      const compiled = new PgDialect().sqlToQuery(query as never);
      return /last_sequence/.test(compiled.sql) ? [{ last_sequence: 6 }] : [];
    });
    const capture = mockInsertCapture();
    const response = await POST(postRequest(URL_, COMPLETE));
    expect(response.status).toBe(200);
    const year = new Date().getUTCFullYear();
    expect(capture()).toMatchObject({ ...COMPLETE, organizationId: ORG_A, campaignCode: `CMP-${year}-0007` });
    const statements = m.dbExecute.mock.calls
      .map(([q]) => { try { return new PgDialect().sqlToQuery(q as never); } catch { return null; } })
      .filter((q): q is { sql: string; params: unknown[] } => q !== null);
    expect(statements.find((q) => q.sql.includes('pg_advisory_xact_lock'))?.params[0]).toContain(`:${ORG_A}:CMP-${year}-`);
    const read = statements.find((q) => q.sql.includes('last_sequence'));
    expect(read?.sql).toContain('organizing_campaigns');
    expect(read?.params).toContain(ORG_A);
    expect(read?.params).not.toContain(ORG_B);
  });

  it('refuses a body that names the campaign code, before any write', async () => {
    const { POST } = await import('../route');
    m.getCurrentUser.mockResolvedValue(authUser('officer'));
    const capture = mockInsertCapture();
    const response = await POST(postRequest(URL_, { ...COMPLETE, campaignCode: 'TAKEN-ELSEWHERE' }));
    expect(response.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it.each([
    ['campaignName', { campaignName: undefined }],
    ['targetEmployer', { targetEmployer: '  ' }],
    ['workplaceLocation', { workplaceLocation: undefined }],
    ['estimatedUnitSize', { estimatedUnitSize: undefined }],
    ['estimatedUnitSize', { estimatedUnitSize: 0 }],
    ['estimatedUnitSize', { estimatedUnitSize: 2.5 }],
  ] as const)('answers 400 naming %s when it is missing or invalid, instead of a 500 from the insert', async (field, change) => {
    const { POST } = await import('../route');
    m.getCurrentUser.mockResolvedValue(authUser('officer'));
    const capture = mockInsertCapture();
    const body: Record<string, unknown> = { ...COMPLETE, ...change };
    for (const [k, v] of Object.entries(body)) if (v === undefined) delete body[k];
    const response = await POST(postRequest(URL_, body));
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain(field);
    expect(capture()).toBeUndefined();
    expect(m.dbExecute.mock.calls.some(([q]) => { try { return new PgDialect().sqlToQuery(q as never).sql.includes('last_sequence'); } catch { return false; } })).toBe(false);
  });
});
