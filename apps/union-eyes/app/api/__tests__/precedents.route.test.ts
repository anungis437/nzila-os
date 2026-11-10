import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  listPrecedents: vi.fn(),
  createPrecedentAudited: vi.fn(),
  getPrecedentStatistics: vi.fn(),
  getMostCitedPrecedents: vi.fn(),
  getPrecedentsByIssueType: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/services/precedent-service', () => ({
  listPrecedents: m.listPrecedents,
  getPrecedentStatistics: m.getPrecedentStatistics,
  getMostCitedPrecedents: m.getMostCitedPrecedents,
  getPrecedentsByIssueType: m.getPrecedentsByIssueType,
}));
vi.mock('@/lib/services/precedent-audited-service', () => ({
  createPrecedentAudited: m.createPrecedentAudited,
}));
vi.mock('@/lib/precedents/jurisdiction-preference-resolver', () => ({
  resolvePrecedentJurisdictions: vi.fn(async () => ({ applied: false, jurisdictions: [], source: 'none' })),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../precedents/route');
}

describe('precedents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    // The library is read by members and written by the platform's content managers; this role does both.
    caller.role = 'content_manager';
    m.getPrecedentStatistics.mockResolvedValue({ total: 12 });
    m.listPrecedents.mockResolvedValue({ precedents: [{ id: 'p3' }], count: 1 });
    m.createPrecedentAudited.mockResolvedValue({ id: 'p4' });
  });

  it('declares what it asks of the wrapper: a member to read (in the organization\'s tenant transaction) and a content manager to create, in a transaction the audited service opens itself', async () => {
    await loadRoute();
    const list = declared.find((entry) => entry.openapi?.summary === 'List, filter and rank arbitration precedents');
    const create = declared.find((entry) => entry.openapi?.summary === 'Create a precedent draft awaiting review');

    expect(list?.auth).toEqual({ minRole: 'member' });
    expect(list?.rlsOrgContext).toBe(true);
    expect(create?.auth).toEqual({ minRole: 'content_manager' });
    expect(create?.rlsOrgContext).toBeUndefined();
  });

  it('bounds pagination on all list modes before calling the service', async () => {
    caller.role = 'member';
    const { GET } = await loadRoute();
    for (const suffix of [
      '?limit=1000000', '?page=-1', '?page=1junk', '?limit=0',
      '?mostCited=true&limit=999999', '?issueType=discipline&limit=101',
      '?sortBy=unknown', '?sortOrder=sideways',
    ]) {
      const response = await GET(new NextRequest('http://localhost/api/precedents' + suffix));
      expect(response.status, suffix).toBe(400);
    }
    expect(m.listPrecedents).not.toHaveBeenCalled();
    expect(m.getMostCitedPrecedents).not.toHaveBeenCalled();
    expect(m.getPrecedentsByIssueType).not.toHaveBeenCalled();
  });

  it('passes validated page and limit to the listing and bounded special modes', async () => {
    const { GET } = await loadRoute();
    expect((await GET(new NextRequest('http://localhost/api/precedents?page=2&limit=30'))).status).toBe(200);
    expect(m.listPrecedents).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ page: 2, limit: 30 }));
    m.getMostCitedPrecedents.mockResolvedValue([]);
    expect((await GET(new NextRequest('http://localhost/api/precedents?mostCited=true&limit=100'))).status).toBe(200);
    expect(m.getMostCitedPrecedents).toHaveBeenCalledWith(100, []);
  });

  it('returns precedent statistics', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/precedents?statistics=true'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ total: 12, jurisdictionPreference: { applied: false, jurisdictions: [], source: 'none' } });
  });

  async function validBody(overrides: Record<string, unknown> = {}) {
    const schema = await import('@/db/schema');
    return {
      caseNumber: '1',
      caseTitle: 'Case',
      tribunal: schema.tribunalTypeEnum.enumValues[0],
      decisionType: schema.decisionTypeEnum.enumValues[0],
      decisionDate: '2024-01-15',
      arbitrator: 'arb',
      union: 'union',
      employer: 'employer',
      outcome: schema.outcomeEnum.enumValues[0],
      precedentValue: schema.precedentValueEnum.enumValues[0],
      fullText: 'text',
      ...overrides,
    };
  }

  const postRequest = (body: unknown) =>
    new NextRequest('http://localhost/api/precedents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('requires a platform role to create a precedent: a tenant steward or administrator is refused before the service is reached', async () => {
    const { POST } = await loadRoute();

    for (const role of ['member', 'steward', 'officer', 'admin']) {
      caller.role = role;
      const response = await POST(postRequest(await validBody()));
      expect(response.status, role).toBe(403);
    }
    expect(m.createPrecedentAudited).not.toHaveBeenCalled();
  });

  it('creates a precedent through the audited service scoped to the caller organization and user', async () => {
    const { POST } = await loadRoute();
    const response = await POST(postRequest(await validBody()));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toEqual({ precedent: { id: 'p4' }, publicationStatus: 'pending_review', publiclyDiscoverable: false });
    expect(m.createPrecedentAudited).toHaveBeenCalledWith(
      { organizationId: 'org_1', userId: 'u1' },
      expect.objectContaining({ caseNumber: '1', decisionDate: expect.any(Date) }),
    );
  });

  it('rejects a body with invalid enum values without creating anything', async () => {
    const { POST } = await loadRoute();
    const response = await POST(postRequest(await validBody({ tribunal: 'tribunal', outcome: 'outcome' })));

    expect(response.status).toBe(400);
    expect(m.createPrecedentAudited).not.toHaveBeenCalled();
  });

  it('fails closed without an active organization or an authenticated user and does not create', async () => {
    const { POST } = await loadRoute();
    const body = await validBody();

    caller.organizationId = null;
    const noOrg = await POST(postRequest(body));
    caller.organizationId = 'org_1';
    caller.userId = null;
    const noUser = await POST(postRequest(body));

    expect(noOrg.status).toBe(403);
    expect(noUser.status).toBe(401);
    expect(m.createPrecedentAudited).not.toHaveBeenCalled();
  });

  it('maps a duplicate case number to a conflict response', async () => {
    m.createPrecedentAudited.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const { POST } = await loadRoute();
    const response = await POST(postRequest(await validBody()));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.code).toBe('ALREADY_EXISTS');
  });
});
