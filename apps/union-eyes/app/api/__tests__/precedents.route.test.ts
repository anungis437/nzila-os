import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  listPrecedents: vi.fn(),
  createPrecedent: vi.fn(),
  getPrecedentStatistics: vi.fn(),
  getMostCitedPrecedents: vi.fn(),
  getPrecedentsByIssueType: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/services/precedent-service', () => ({
  listPrecedents: m.listPrecedents,
  createPrecedent: m.createPrecedent,
  getPrecedentStatistics: m.getPrecedentStatistics,
  getMostCitedPrecedents: m.getMostCitedPrecedents,
  getPrecedentsByIssueType: m.getPrecedentsByIssueType,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), {
      status: code === 'INTERNAL_ERROR' ? 500 : 400,
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
    m.createPrecedent.mockResolvedValue({ id: 'p4' });
  });

  it('returns precedent statistics', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/precedents?statistics=true'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ total: 12 });
  });

  it('creates a precedent', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/precedents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseNumber: '1',
          caseTitle: 'Case',
          tribunal: 'tribunal',
          decisionType: true,
          decisionDate: true,
          arbitrator: 'arb',
          union: 'union',
          employer: 'employer',
          outcome: 'outcome',
          precedentValue: 'value',
          fullText: 'text',
        }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.precedent).toEqual({ id: 'p4' });
  });
});
