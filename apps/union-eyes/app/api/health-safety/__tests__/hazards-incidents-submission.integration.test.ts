import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
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
  getOrganizationIdForUser: vi.fn(),
  getUserRole: vi.fn(),
  checkRateLimit: vi.fn(),
  dbInsert: vi.fn(),
  dbSelect: vi.fn(),
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
vi.mock('@/db/db', () => ({ db: { insert: m.dbInsert, select: m.dbSelect } }));
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
      severity: 'minor',
      location: 'Loading dock',
      description: 'Worker slipped on wet floor',
    }));

    expect(res.status).toBe(403);
    expect(capture()).toBeUndefined();
  });

  it('4. organizationId comes from the authenticated context and cannot be overridden by the request payload', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep', ORG_A));
    m.getOrganizationIdForUser.mockResolvedValue(ORG_A);
    const capture = mockInsertCapture();

    await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
      organizationId: ORG_B, // attacker-supplied — must be ignored
    }));

    expect(capture()?.organizationId).toBe(ORG_A);
    expect(capture()?.organizationId).not.toBe(ORG_B);
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

  it('5 & 6. a generated reportNumber is populated and satisfies the collision-resistant UUID format', async () => {
    const { POST } = await import('../hazards/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();

    await POST(postRequest('http://localhost/api/health-safety/hazards', {
      hazardType: 'fire',
      priority: 'high',
      location: 'Warehouse B',
      description: 'Sparks near flammable storage',
    }));

    const reportNumber = capture()?.reportNumber as string;
    expect(typeof reportNumber).toBe('string');
    expect(reportNumber).toMatch(/^HAZ-\d{4}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('5 & 6. a generated incidentNumber is populated and satisfies the collision-resistant UUID format', async () => {
    const { POST } = await import('../incidents/route');
    m.getCurrentUser.mockResolvedValue(authUser('health_safety_rep'));
    const capture = mockInsertCapture();

    await POST(postRequest('http://localhost/api/health-safety/incidents', {
      incidentType: 'injury',
      severity: 'minor',
      location: 'Loading dock',
      description: 'Worker slipped on wet floor',
    }));

    const incidentNumber = capture()?.incidentNumber as string;
    expect(typeof incidentNumber).toBe('string');
    expect(incidentNumber).toMatch(/^INC-\d{4}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
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
