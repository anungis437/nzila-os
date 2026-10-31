import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B6-CMP-READ-FAILURE-RETURNS-EMPTY-SUCCESS: a failed query is an error, not "no alerts" or "no reports".
const m = vi.hoisted(() => ({ select: vi.fn(), hasMinRole: vi.fn() }));

vi.mock('@/db/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema/domains/compliance/employer-compliance', () => ({
  complianceAlerts: { id: 'id', orgId: 'orgId', employerId: 'employerId', createdAt: 'createdAt' },
  employerReports: { id: 'id', employerId: 'employerId', createdAt: 'createdAt' },
}));
vi.mock('@/db/schema/union-structure-schema', () => ({ employers: { id: 'id', name: 'name', organizationId: 'organizationId' } }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (request: NextRequest, context: { organizationId: string }) => unknown) =>
    (request: NextRequest) => handler(request, { organizationId: 'org-1' }),
}));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }));

const request = () => new NextRequest('http://localhost/api/compliance/x');

function chainResolving(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const name of ['from', 'innerJoin', 'where', 'orderBy', 'limit']) chain[name] = () => chain;
  (chain as { then: unknown }).then = (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe('compliance alert and report reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasMinRole.mockResolvedValue(true);
  });

  it('alerts answer 500, not an empty success, when the query fails', async () => {
    m.select.mockImplementation(() => { throw new Error('connection refused'); });
    const { GET } = await import('../compliance/alerts/route');

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).not.toMatchObject({ data: [] });
  });

  it('reports answer 500, not an empty success, when the query fails', async () => {
    m.select.mockImplementation(() => { throw new Error('connection refused'); });
    const { GET } = await import('../compliance/reports/route');

    const response = await GET(request());

    expect(response.status).toBe(500);
  });

  it('alerts still answer an organization with no alerts as an empty list', async () => {
    m.select.mockImplementation(() => chainResolving([]));
    const { GET } = await import('../compliance/alerts/route');

    const response = await GET(request());

    expect(response.status).toBe(200);
  });
});
