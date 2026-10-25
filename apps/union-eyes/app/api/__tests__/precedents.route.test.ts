import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  listPrecedents: vi.fn(),
  createPrecedentAudited: vi.fn(),
  getPrecedentStatistics: vi.fn(),
  getMostCitedPrecedents: vi.fn(),
  getPrecedentsByIssueType: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/services/precedent-service', () => ({
  listPrecedents: m.listPrecedents,
  getPrecedentStatistics: m.getPrecedentStatistics,
  getMostCitedPrecedents: m.getMostCitedPrecedents,
  getPrecedentsByIssueType: m.getPrecedentsByIssueType,
}));
vi.mock('@/lib/services/precedent-audited-service', () => ({
  createPrecedentAudited: m.createPrecedentAudited,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    FORBIDDEN: 'FORBIDDEN',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), {
      status: code === 'INTERNAL_ERROR' ? 500 : code === 'FORBIDDEN' ? 403 : 400,
    }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

async function loadRoute() {
  return import('../precedents/route');
}

describe('precedents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {}) => handler(request, context),
    );
    m.getPrecedentStatistics.mockResolvedValue({ total: 12 });
    m.listPrecedents.mockResolvedValue({ precedents: [{ id: 'p3' }], count: 1 });
    m.createPrecedentAudited.mockResolvedValue({ id: 'p4' });
  });

  it('returns precedent statistics', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/precedents?statistics=true'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ total: 12 });
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

  it('requires the content_manager role to create a precedent', async () => {
    vi.resetModules();
    await loadRoute();
    expect(m.withRoleAuth).toHaveBeenCalledWith('content_manager', expect.any(Function));
  });

  it('creates a precedent through the audited service scoped to the caller organization and user', async () => {
    const { POST } = await loadRoute();
    const response = await POST(postRequest(await validBody()), { userId: 'u1', organizationId: 'org_1' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.precedent).toEqual({ id: 'p4' });
    expect(m.createPrecedentAudited).toHaveBeenCalledWith(
      { organizationId: 'org_1', userId: 'u1' },
      expect.objectContaining({ caseNumber: '1', decisionDate: expect.any(Date) }),
    );
  });

  it('rejects a body with invalid enum values without creating anything', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      postRequest(await validBody({ tribunal: 'tribunal', outcome: 'outcome' })),
      { userId: 'u1', organizationId: 'org_1' },
    );

    expect(response.status).toBe(400);
    expect(m.createPrecedentAudited).not.toHaveBeenCalled();
  });

  it('fails closed without an active organization or user and does not create', async () => {
    const { POST } = await loadRoute();
    const body = await validBody();

    const noOrg = await POST(postRequest(body), { userId: 'u1' });
    const noUser = await POST(postRequest(body), { organizationId: 'org_1' });

    expect(noOrg.status).toBe(403);
    expect(noUser.status).toBe(403);
    expect(m.createPrecedentAudited).not.toHaveBeenCalled();
  });

  it('maps a duplicate case number to a conflict response', async () => {
    m.createPrecedentAudited.mockRejectedValue(Object.assign(new Error('dup'), { code: '23505' }));
    const { POST } = await loadRoute();
    const response = await POST(postRequest(await validBody()), { userId: 'u1', organizationId: 'org_1' });
    const json = await response.json();

    expect(json.code).toBe('ALREADY_EXISTS');
  });
});