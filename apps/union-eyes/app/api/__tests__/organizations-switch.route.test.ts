import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  selectQueue: [] as unknown[][],
}));

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
}));

vi.mock('@/db/db', () => ({ db: mockDb }));

async function loadRoute() {
  return import('../organizations/switch/route');
}

describe('organizations/switch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'user_1' });
    delete process.env.PLATFORM_ADMIN_USER_IDS;
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('POST returns 400 for invalid JSON body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    );

    expect(response.status).toBe(400);
  });

  it('POST returns 400 when organizationId missing', async () => {
    const { POST } = await loadRoute();

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
  });

  it('POST returns 404 when organization is not found', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_404' }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it('POST returns 403 when non-admin user has no membership', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'org_1', name: 'Org 1', slug: 'org-1' }],
      [],
      [],
    );

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(403);
  });

  it('POST allows platform admin to switch without membership', async () => {
    const { POST } = await loadRoute();
    process.env.PLATFORM_ADMIN_USER_IDS = 'user_1,other_user';
    m.selectQueue.push([
      {
        id: 'org_1',
        name: 'Org 1',
        slug: 'org-1',
        organizationType: 'union',
        parentId: null,
        sectors: ['healthcare'],
        provinceTerritory: 'ON',
        description: 'Union org',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-02-01T00:00:00.000Z'),
      },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.organization).toMatchObject({ id: 'org_1', name: 'Org 1', slug: 'org-1' });
  });

  it('POST allows member user with UUID membership', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'org_1', name: 'Org 1', slug: 'org-1' }],
      [{ id: 'membership_1', userId: 'user_1', organizationId: 'org_1' }],
    );

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('POST allows member user with slug membership fallback', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'org_1', name: 'Org 1', slug: 'org-1' }],
      [],
      [{ id: 'membership_2', userId: 'user_1', organizationId: 'org-1' }],
    );

    const response = await POST(
      new NextRequest('http://localhost/api/organizations/switch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId: 'org_1' }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });
});
