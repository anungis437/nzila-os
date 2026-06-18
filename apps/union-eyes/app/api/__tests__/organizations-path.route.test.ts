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
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    inArray: vi.fn(() => 'inArray'),
  };
});

async function loadRoute() {
  return import('../organizations/[id]/path/route');
}

describe('organizations/[id]/path route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(
      new NextRequest('http://localhost/api/organizations/org_1/path'),
      { params: Promise.resolve({ id: 'org_1' }) },
    );

    expect(response.status).toBe(401);
  });

  it('GET returns empty data when organization is not found', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(
      new NextRequest('http://localhost/api/organizations/org_1/path'),
      { params: Promise.resolve({ id: 'org_1' }) },
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual([]);
  });

  it('GET returns path containing only org when hierarchyPath is empty', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      {
        id: 'org_1',
        name: 'Org 1',
        slug: 'org-1',
        organizationType: 'union',
        parentId: null,
        sectors: ['healthcare'],
        provinceTerritory: 'ON',
        description: null,
        hierarchyLevel: 0,
        hierarchyPath: [],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      },
    ]);

    const response = await GET(
      new NextRequest('http://localhost/api/organizations/org_1/path'),
      { params: Promise.resolve({ id: 'org_1' }) },
    );

    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].id).toBe('org_1');
  });

  it('GET resolves hierarchy tokens (uuid and slug) and appends current org', async () => {
    const { GET } = await loadRoute();
    const parentUuid = '123e4567-e89b-12d3-a456-426614174000';

    m.selectQueue.push(
      [
        {
          id: 'org_1',
          name: 'Org 1',
          slug: 'org-1',
          organizationType: 'union',
          parentId: null,
          sectors: ['healthcare'],
          provinceTerritory: 'ON',
          description: null,
          hierarchyLevel: 1,
          hierarchyPath: [parentUuid, 'parent-slug'],
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ],
      [
        {
          id: parentUuid,
          name: 'Parent Org',
          slug: 'parent-slug',
          organizationType: 'federation',
          parentId: null,
          sectors: [],
          provinceTerritory: 'CA',
          description: null,
          hierarchyLevel: 0,
          hierarchyPath: [],
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ],
      [
        {
          id: parentUuid,
          name: 'Parent Org',
          slug: 'parent-slug',
          organizationType: 'federation',
          parentId: null,
          sectors: [],
          provinceTerritory: 'CA',
          description: null,
          hierarchyLevel: 0,
          hierarchyPath: [],
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      ],
    );

    const response = await GET(
      new NextRequest('http://localhost/api/organizations/org_1/path'),
      { params: Promise.resolve({ id: 'org_1' }) },
    );

    const json = await response.json();
    expect(json.data.length).toBeGreaterThanOrEqual(2);
    expect(json.data[json.data.length - 1].id).toBe('org_1');
  });
});
