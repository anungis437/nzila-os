import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  searchPrecedents: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/services/precedent-service', () => ({ searchPrecedents: m.searchPrecedents }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string, details?: unknown) => new Response(JSON.stringify({ code, message, details }), { status: code === 'INTERNAL_ERROR' ? 500 : 400 }),
}));

async function loadRoute() {
  return import('../precedents/search/route');
}

describe('precedents/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {}) => handler(request, context),
    );
    m.searchPrecedents.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('searches precedents', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/precedents/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'arbitration', filters: {}, limit: 10 }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.count).toBe(2);
    expect(m.searchPrecedents).toHaveBeenCalledWith('arbitration', {}, 10);
  });
});