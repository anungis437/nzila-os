import { vi, describe, expect, it } from 'vitest';

// Authentication is the guard's own contract; these tests exercise the retired handler behind it.
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));

const ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const CASE_ROUTES = 'the dedicated case routes under /api/cases/{caseId}';
const DOCS = '/api/documents/repository';

// Each retired endpoint, the only methods it still exports, and the endpoint it points callers to.
const RETIRED: Array<[string, () => Promise<Record<string, unknown>>, readonly string[], string]> = [
  ['cases/evidence', () => import('../cases/evidence/route'), ['GET', 'POST'], '/api/cases/{caseId}/evidence'],
  ['cases/meetings', () => import('../cases/meetings/route'), ['GET', 'POST'], CASE_ROUTES],
  ['cases/outcomes', () => import('../cases/outcomes/route'), ['GET', 'POST'], CASE_ROUTES],
  ['cases/templates', () => import('../cases/templates/route'), ['GET', 'POST'], CASE_ROUTES],
  ['cases/templates/generate', () => import('../cases/templates/generate/route'), ['GET', 'POST'], CASE_ROUTES],
  ['cases/timeline', () => import('../cases/timeline/route'), ['GET', 'POST'], '/api/cases/{caseId}/timeline'],
  ['claims/[id]/defensibility-pack', () => import('../claims/[id]/defensibility-pack/route'), ['GET', 'PATCH', 'DELETE'], CASE_ROUTES],
  ['claims/[id]/status', () => import('../claims/[id]/status/route'), ['GET', 'PATCH', 'DELETE'], '/api/cases/{caseId}/transition'],
  ['claims/[id]/updates', () => import('../claims/[id]/updates/route'), ['GET', 'PATCH', 'DELETE'], '/api/cases/{caseId}/notes'],
  ['claims/[id]/workflow', () => import('../claims/[id]/workflow/route'), ['GET', 'PATCH', 'DELETE'], '/api/cases/{caseId}/next-actions'],
  ['documents', () => import('../documents/route'), ['GET', 'POST'], DOCS],
  ['documents/bulk', () => import('../documents/bulk/route'), ['POST'], DOCS],
  ['documents/categories', () => import('../documents/categories/route'), ['GET', 'POST'], DOCS],
  ['documents/folders', () => import('../documents/folders/route'), ['GET', 'POST'], DOCS],
  ['documents/[id]', () => import('../documents/[id]/route'), ['GET', 'PATCH', 'DELETE'], `${DOCS}/{id}`],
  ['documents/[id]/ocr', () => import('../documents/[id]/ocr/route'), ['POST'], DOCS],
];

describe.each(RETIRED)('retired route %s', (_name, load, methods, replacement) => {
  it('exports only its original methods', async () => {
    const mod = await load();
    expect(ALL_METHODS.filter((method) => typeof mod[method] === 'function')).toEqual(methods);
  });

  it.each(methods)('%s answers 501 NOT_IMPLEMENTED, names its replacement and does nothing else', async (method) => {
    const mod = await load();
    const handler = mod[method] as (request: Request, context: unknown) => Promise<Response>;
    const response = await handler(
      new Request('http://localhost/api/retired', { method, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' }),
      { params: Promise.resolve({ id: 'x' }) },
    );
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain(replacement);
  });
});

describe('investigations routes that delegate to retired case routes', () => {
  it.each([
    ['investigations/evidence', () => import('../investigations/evidence/route')],
    ['investigations/timeline', () => import('../investigations/timeline/route')],
  ])('%s answers 501 for GET and POST', async (_name, load) => {
    const mod = await load();
    for (const method of ['GET', 'POST'] as const) {
      const handler = mod[method] as (request: Request, context: unknown) => Promise<Response>;
      const response = await handler(new Request('http://localhost/api/investigations', { method, body: method === 'POST' ? '{}' : undefined }), {});
      expect(response.status).toBe(501);
      expect((await response.json()).error.code).toBe('NOT_IMPLEMENTED');
    }
  });
});
