import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  searchPrecedents: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/services/precedent-service', () => ({ searchPrecedents: m.searchPrecedents }));
vi.mock('@/lib/precedents/jurisdiction-preference-resolver', () => ({
  resolvePrecedentJurisdictions: vi.fn(async () => ({ applied: false, jurisdictions: [], source: 'none' })),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

async function loadRoute() {
  return import('../precedents/search/route');
}

const post = (body: unknown) => new NextRequest('http://localhost/api/precedents/search', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('precedents/search route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.role = 'steward';
    m.searchPrecedents.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
  });

  it('declares what it asks of the wrapper: a steward, reading the tenant-scoped decisions in the organization\'s tenant transaction', async () => {
    await loadRoute();
    const config = declared.find((entry) => entry.openapi?.summary === 'Search arbitration precedents');

    expect(config?.auth).toEqual({ minRole: 'steward' });
    expect(config?.rlsOrgContext).toBe(true);
    expect(config?.requireOrg).toBeUndefined();
  });

  it('refuses a member before the search is reached', async () => {
    caller.role = 'member';
    const { POST } = await loadRoute();

    const response = await POST(post({ query: 'arbitration', filters: {}, limit: 10 }));

    expect(response.status).toBe(403);
    expect(m.searchPrecedents).not.toHaveBeenCalled();
  });

  it('refuses a caller with no active organization before the search is reached', async () => {
    caller.organizationId = null;
    const { POST } = await loadRoute();

    expect((await POST(post({ query: 'arbitration' }))).status).toBe(403);
    expect(m.searchPrecedents).not.toHaveBeenCalled();
  });

  it('searches precedents', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ query: 'arbitration', filters: {}, limit: 10 }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.count).toBe(2);
    expect(m.searchPrecedents).toHaveBeenCalledWith('arbitration', { jurisdiction: undefined }, 10);
  });

  it('answers 400, and searches nothing, for a body that is not JSON, an empty query or a filter the search does not read', async () => {
    const { POST } = await loadRoute();

    expect((await POST(post('{not json'))).status).toBe(400);
    expect((await POST(post({ query: '' }))).status).toBe(400);
    expect((await POST(post({ query: 'arbitration', filters: { organizationId: 'org_other' } }))).status).toBe(400);
    expect(m.searchPrecedents).not.toHaveBeenCalled();
  });

  it('answers 400 for a filter value the column does not declare', async () => {
    m.searchPrecedents.mockRejectedValueOnce(Object.assign(new Error('Invalid tribunal filter'), { code: 'INVALID_PRECEDENT_FILTER' }));
    const { POST } = await loadRoute();

    const response = await POST(post({ query: 'arbitration', filters: { tribunal: ['nope'] } }));

    expect(response.status).toBe(400);
  });
});
