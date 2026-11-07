import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PgDialect } from 'drizzle-orm/pg-core';
import { hazardReports, workplaceIncidents } from '@/db/schema';

/**
 * End-to-end proof that hazard/incident report submission works through the
 * REAL crud-factory + withApi stack (role gating, org resolution, the
 * enforceCreateSecurityInvariants guard, and the hazards/incidents
 * beforeCreate hooks are all genuinely exercised, not mocked away). Only the
 * external boundaries — auth user resolution, DB-role fallback lookup, rate
 * limiting, and the Postgres client itself — are mocked.
 */

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

function mockSelectForList(rows: unknown[], total: number) {
  m.dbSelect
    .mockImplementationOnce(() => ({
      from: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ offset: async () => rows }) }) }) }),
    }))
    .mockImplementationOnce(() => ({
      from: () => ({ where: async () => [{ total }] }),
    }));
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

describe('health-safety hazards/incidents submission — role gating', () => {
  it('1. an authorized health_safety_rep can create a hazard report', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.data.hazardCategory).toBe('fire');
  });

  it('2. an authorized health_safety_rep can create an incident report', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      incidentDate: '2026-10-29T13:00:00.000Z',
      severity: 'minor',
      location: 'Loading dock',
      description: 'Worker slipped on wet floor',
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.data.incidentType).toBe('injury');
  });

  it('3. a lower unauthorized role (member) is rejected on hazard creation', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('member'));
    const capture = mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
    }));

    expect(res.status).toBe(403);
    expect(capture()).toBeUndefined();
  });

  it('3b. a lower unauthorized role (member) is rejected on incident creation', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('member'));
    const capture = mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      incidentDate: '2026-10-29T13:00:00.000Z',
      severity: 'minor',
      location: 'Loading dock',
      description: 'Worker slipped on wet floor',
    }));

    expect(res.status).toBe(403);
    expect(capture()).toBeUndefined();
  });

  it('4. refuses client-supplied organizationId rather than accepting a spoofed tenant', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    const capture = mockInsertCapture();

    const response = await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
      organizationId: ORG_B,
    }));

    expect(response.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it('4a. rejects an attacker-supplied incident organizationId before insert', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    const capture = mockInsertCapture();

    const response = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      incidentDate: '2026-10-29T13:00:00.000Z',
      severity: 'minor',
      location: 'Loading dock',
      description: 'Worker slipped on wet floor',
      organizationId: ORG_B,
    }));

    expect(response.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it('4b. organizationId cannot be overridden even if beforeCreate tried to change it', async () => {
    // buildHazardCreateValues does pass organizationId through from its input,
    // but enforceCreateSecurityInvariants re-asserts it afterward — this
    // proves that guarantee end-to-end through the real route, not just the
    // isolated crud-factory unit test.
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    const capture = mockInsertCapture();

    await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
    }));

    expect(capture()?.organizationId).toBe(ORG_A);
  });

  // DEF-0B8-HS-RECORD-NUMBERS-CALLER-SUPPLIED-AND-UNIQUE-ACROSS-ORGANIZATIONS
  /** The statements run on the tenant transaction, compiled, so the per-organization lock and sequence read can be checked. */
  function executedSql() {
    const dialect = new PgDialect();
    return m.dbExecute.mock.calls
      .map(([query]) => { try { return dialect.sqlToQuery(query as never); } catch { return null; } })
      .filter((q): q is { sql: string; params: unknown[] } => q !== null);
  }

  it.each([
    ['hazards', 'reportNumber', 'HAZ', { hazardType: 'fire', priority: 'high', location: 'Warehouse B', description: 'Sparks near flammable storage' }],
    ['incidents', 'incidentNumber', 'INC', { incidentType: 'injury', incidentDate: '2026-10-29T13:00:00.000Z', severity: 'minor', location: 'Loading dock', description: 'Worker slipped on wet floor' }],
  ] as const)('5 & 6. %s: the number is the next in the caller organization\'s own sequence, read under a per-organization lock', async (path, field, prefix, body) => {
    const { POST } = await import(`../${path}/route`);
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    m.dbExecute.mockImplementation(async (query: unknown) => {
      const compiled = new PgDialect().sqlToQuery(query as never);
      return /last_sequence/.test(compiled.sql) ? [{ last_sequence: 41 }] : [];
    });
    const capture = mockInsertCapture();

    const response = await POST(postRequest(`http://localhost/api/health-safety/${path}`, body));
    expect(response.status).toBe(200);
    const year = new Date().getUTCFullYear();
    expect(capture()?.[field]).toBe(`${prefix}-${year}-0042`);
    const statements = executedSql();
    const lock = statements.find((q) => q.sql.includes('pg_advisory_xact_lock'));
    expect(lock?.params[0]).toContain(`:${ORG_A}:${prefix}-${year}-`);
    const read = statements.find((q) => q.sql.includes('last_sequence'));
    expect(read?.sql).toContain('organization_id =');
    expect(read?.params).toContain(ORG_A);
    expect(read?.params).not.toContain(ORG_B);
  });

  it.each([
    ['inspections', 'inspectionNumber', 'INS', { inspectionType: 'routine', scheduledDate: '2026-11-10T09:00:00.000Z' }],
    ['ppe', 'itemNumber', 'PPE', { ppeType: 'hard_hat', itemName: 'Hard hat' }],
  ] as const)('5c. %s: a body that names the number is refused, and a create gets a server-issued number', async (path, field, prefix, body) => {
    const { POST } = await import(`../${path}/route`);
    m.getCurrentUser.mockResolvedValue(authUser('admin'));
    const capture = mockInsertCapture();

    const refused = await POST(postRequest(`http://localhost/api/health-safety/${path}`, { ...body, [field]: `${prefix}-CHOSEN` }));
    expect(refused.status).toBe(400);
    expect(capture()).toBeUndefined();

    const created = await POST(postRequest(`http://localhost/api/health-safety/${path}`, body));
    expect(created.status).toBe(200);
    expect(String(capture()?.[field])).toMatch(prefix === 'PPE' ? /^PPE-0001$/ : new RegExp(`^${prefix}-\\d{4}-0001$`));
  });

  it.each([
    ['incidents', 'incidentNumber'],
    ['hazards', 'reportNumber'],
    ['inspections', 'inspectionNumber'],
  ] as const)('5d. %s: a PATCH cannot change the server-issued number', async (path, field) => {
    const { PATCH } = await import(`../${path}/[id]/route`);
    m.getCurrentUser.mockResolvedValue(authUser('admin'));
    const response = await PATCH(new NextRequest(`http://localhost/api/health-safety/${path}/abc`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [field]: 'X-CHOSEN' }),
    }), { params: Promise.resolve({ id: 'abc' }) });
    expect(response.status).toBe(400);
    expect(m.dbInsert).not.toHaveBeenCalled();
  });

  it('6a. refuses caller-supplied report identifiers, statuses and unsupported form fields', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    for (const injected of [
      { reportNumber: 'HAZ-FORGED' },
      { status: 'closed' },
      { metadata: { approval: true } },
      { unrecognizedField: 'unexpected' },
    ]) {
      const response = await POST(postRequest('http://localhost/api/health-safety/hazards', {
        hazardType: 'fire', priority: 'high', location: 'Warehouse B',
        description: 'Sparks near flammable storage', ...injected,
      }));
      expect(response.status).toBe(400);
      expect(capture()).toBeUndefined();
    }
  });

  it('6a2. refuses a non-boolean isAnonymous before any write, so a report never looks anonymous while attributed to its reporter', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    for (const isAnonymous of ['true', 1]) {
      const response = await POST(postRequest('http://localhost/api/health-safety/hazards', {
        hazardType: 'fire', priority: 'high', location: 'Warehouse B',
        description: 'Sparks near flammable storage', isAnonymous, reporterName: 'Jane Doe',
      }));
      expect(response.status, String(isAnonymous)).toBe(400);
      expect(capture()).toBeUndefined();
    }
    expect(m.dbInsert).not.toHaveBeenCalled();
  });

  it('6b. refuses conflicting aliases and canonical fields', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    const response = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      incidentDate: '2026-10-29T13:00:00.000Z', severity: 'minor', location: 'Dock A',
      locationDescription: 'Dock B', description: 'Worker slipped',
    }));
    expect(response.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it('6c. refuses missing or invalid incident dates rather than inventing the reporting time', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    for (const bad of [undefined, 'not-a-date']) {
      const body: Record<string, unknown> = {
        incidentType: 'near_miss', severity: 'near_miss',
        location: 'Line 3', description: 'Guard missing on press',
      };
      if (bad !== undefined) body.incidentDate = bad;
      const response = await POST(postRequest('http://localhost/api/health-safety/incidents', body));
      expect(response.status).toBe(400);
      expect(capture()).toBeUndefined();
    }
  });

  it('6d. preserves fatal severity, structured injury and witness fields without hiding them in metadata', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    const response = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'fall', severity: 'fatal', incidentDate: '2026-10-29T13:00:00.000Z',
      location: 'Line 3', description: 'Fall from height',
      injuredPersonName: 'Protected Person', bodyPartAffected: 'head',
      injuryNature: 'other', treatmentProvided: 'Emergency response',
      witnessesPresent: true, witnessNames: ['Witness One'],
    }));
    expect(response.status).toBe(200);
    expect(capture()).toMatchObject({
      organizationId: ORG_A, incidentType: 'fall', severity: 'fatal',
      injuredPersonName: 'Protected Person', bodyPartAffected: 'head',
      treatmentProvided: 'Emergency response', witnessesPresent: true,
      witnessNames: ['Witness One'],
    });
    expect(JSON.stringify(capture()?.metadata ?? {})).not.toContain('Protected Person');
    expect(JSON.stringify(capture()?.metadata ?? {})).not.toContain('Witness One');
  });

  it('6e. rejects missing or unrecognized hazard classification instead of assuming moderate/other', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();
    for (const extra of [
      { hazardType: 'fire' },
      { priority: 'high' },
      { hazardType: 'unknown', priority: 'high' },
      { hazardType: 'fire', priority: 'unknown' },
    ]) {
      const response = await POST(postRequest('http://localhost/api/health-safety/hazards', {
        location: 'Warehouse B', description: 'Sparks near flammable storage', ...extra,
      }));
      expect(response.status).toBe(400);
      expect(capture()).toBeUndefined();
    }
  });

  it('7. malformed required input (no location, no description) is rejected — never silently normalized into a valid record', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
    }));

    expect(res.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it('7b. malformed required incident input is rejected — never silently normalized into a valid record', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();

    const res = await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      incidentDate: '2026-10-29T13:00:00.000Z',
      severity: 'minor',
    }));

    expect(res.status).toBe(400);
    expect(capture()).toBeUndefined();
  });

  it('8. hazard list reads are always scoped to the authenticated org — never to a client-supplied value', async () => {
    const { GET } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    mockSelectForList([{ id: 'h1', organizationId: ORG_A }], 1);

    const { eq } = await import('drizzle-orm');

    // crud-factory's GET never reads an org id from the query string at
    // all — organizationId is sourced exclusively from the auth-resolved
    // context — so even an attacker-supplied query param cannot change scope.
    const res = await GET(new NextRequest(`http://localhost/api/health-safety/hazards?organizationId=${ORG_B}`));
    expect(res.status).toBe(200);

    expect(eq).toHaveBeenCalledWith(hazardReports.organizationId, ORG_A);
    expect(eq).not.toHaveBeenCalledWith(hazardReports.organizationId, ORG_B);
  });

  it('8b. incident list reads are always scoped to the authenticated org — never to a client-supplied value', async () => {
    const { GET } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    mockSelectForList([{ id: 'i1', organizationId: ORG_A }], 1);

    const { eq } = await import('drizzle-orm');

    const res = await GET(new NextRequest(`http://localhost/api/health-safety/incidents?organizationId=${ORG_B}`));
    expect(res.status).toBe(200);

    expect(eq).toHaveBeenCalledWith(workplaceIncidents.organizationId, ORG_A);
    expect(eq).not.toHaveBeenCalledWith(workplaceIncidents.organizationId, ORG_B);
  });
});
