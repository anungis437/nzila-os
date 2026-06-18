import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  selectRows: [] as any[],
  createdRow: null as any,
}));

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(async () => m.selectRows),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [m.createdRow]),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../scim/v2/[organizationId]/Users/route');
}

describe('scim users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectRows = [];
    m.createdRow = {
      id: 'm-new',
      userId: 'jane@example.com',
      email: 'jane@example.com',
      name: 'Jane Doe',
      status: 'active',
      joinedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<any>) =>
        async (request: NextRequest, ctx: any = { params: { organizationId: 'org_1' } }) => {
          try {
            return await handler({ ...ctx, request });
          } catch (err) {
            return Promise.reject(err);
          }
        },
    );
  });

  it('GET returns SCIM list response with pagination', async () => {
    const { GET } = await loadRoute();
    m.selectRows = [
      {
        id: 'm1',
        userId: 'john@example.com',
        email: 'john@example.com',
        name: 'John Smith',
        status: 'active',
        joinedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?startIndex=1&count=10'), {
      params: { organizationId: 'org_1' },
    });

    expect(result.totalResults).toBe(1);
    expect(result.itemsPerPage).toBe(1);
    expect(result.Resources[0].userName).toBe('john@example.com');
  });

  it('POST throws bad request when userName is missing', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(new NextRequest('http://localhost/api/scim/v2/org_1/Users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: { givenName: 'No', familyName: 'User' } }),
      }), { params: { organizationId: 'org_1' } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('POST provisions a user and maps to SCIM user payload', async () => {
    const { POST } = await loadRoute();

    const result = await POST(new NextRequest('http://localhost/api/scim/v2/org_1/Users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userName: 'jane@example.com',
        name: { givenName: 'Jane', familyName: 'Doe' },
        emails: [{ value: 'jane@example.com', primary: true }],
      }),
    }), { params: { organizationId: 'org_1' } });

    expect(result.id).toBe('m-new');
    expect(result.userName).toBe('jane@example.com');
    expect(result.name.formatted).toBe('Jane Doe');
  });
});
