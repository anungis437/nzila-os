import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  hasMinRole: vi.fn(),
  readFile: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
  delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 'org_new' }]),
      onConflictDoNothing: vi.fn(async () => undefined),
    })),
  })),
};

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: m.withApiAuth,
  hasMinRole: m.hasMinRole,
}));
vi.mock('fs/promises', () => ({ readFile: m.readFile }));
vi.mock('@nzila/os-core', () => ({ createLogger: () => m.logger }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../admin/seed-cupe-pilot/route');
}

const fixture = {
  org: { name: 'CUPE Local', slug: 'cupe-local-123' },
  members: [
    { id: 'u1', first_name: 'A', last_name: 'One', email: 'a@example.com', role: 'member', member_number: '1' },
  ],
  cases: [
    { number: 'G-1', case_type: 'wage_dispute', status: 'acknowledged', title: 'Case', description: 'Desc', filed_by: 'u1' },
  ],
  worksites: [{ id: 'w1' }],
};

describe('admin/seed-cupe-pilot route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.hasMinRole.mockResolvedValue(true);
    m.readFile.mockResolvedValue(JSON.stringify(fixture));
    m.withApiAuth.mockImplementation((handler: (request: NextRequest) => Promise<Response>) => handler);
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('returns 403 when user lacks required role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/admin/seed-cupe-pilot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }));

    expect(response.status).toBe(403);
  });

  it('creates org when missing and seeds members/cases', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/admin/seed-cupe-pilot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reset: false }),
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.orgId).toBe('org_new');
  });

  it('resets existing org data when reset=true', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'org_existing' }]);

    const response = await POST(new NextRequest('http://localhost/api/admin/seed-cupe-pilot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reset: true }),
    }));

    expect(response.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('returns 500 on unexpected errors', async () => {
    const { POST } = await loadRoute();
    m.readFile.mockRejectedValueOnce(new Error('fs broken'));

    const response = await POST(new NextRequest('http://localhost/api/admin/seed-cupe-pilot', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }));

    expect(response.status).toBe(500);
  });
});
