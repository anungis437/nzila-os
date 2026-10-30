import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  selectRows: [] as any[],
  createdRows: [] as any[],
  persistAtomicAudit: vi.fn(),
  page: null as null | { limit: number; offset: number },
  inserted: null as unknown,
}));

// The route counts the live members, then reads one ordered page of them.
const pagedChain = () => ({ orderBy: () => ({ limit: (n: number) => ({ offset: async (o: number) => { m.page = { limit: n, offset: o }; return m.selectRows; } }) }) });
const mockDb = {
  select: vi.fn((fields?: unknown) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => (fields ? Promise.resolve([{ total: m.selectRows.length }]) : pagedChain())),
    })),
  })),
};
const mockTx = {
  insert: vi.fn(() => ({
    values: vi.fn((v: unknown) => { m.inserted = v; return {
      onConflictDoNothing: vi.fn(() => ({ returning: vi.fn(async () => m.createdRows) })),
    }; }),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
  },
}));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../scim/v2/[organizationId]/Users/route');
}

const ctx = { params: { organizationId: 'org_1' }, organizationId: 'org_1', userId: 'admin_1' };

const provision = (body: unknown) =>
  new NextRequest('http://localhost/api/scim/v2/org_1/Users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('scim users route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectRows = [];
    m.createdRows = [
      {
        id: 'm-new',
        userId: 'jane@example.com',
        email: 'jane@example.com',
        name: 'Jane Doe',
        status: 'active',
        joinedAt: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    m.persistAtomicAudit.mockResolvedValue(undefined);

    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<any>) =>
        async (request: NextRequest, c: any = ctx) => handler({ ...c, request }),
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

    const result = await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?startIndex=1&count=10'), ctx);

    expect(result.totalResults).toBe(1);
    expect(result.itemsPerPage).toBe(1);
    expect(result.Resources[0].userName).toBe('john@example.com');
  });

  it('GET refuses to list another organization\u2019s users, whatever the path names', async () => {
    const { GET } = await loadRoute();

    await expect(
      GET(new NextRequest('http://localhost/api/scim/v2/org_2/Users'), { ...ctx, params: { organizationId: 'org_2' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('POST throws bad request when userName is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST(provision({ name: { givenName: 'No', familyName: 'User' } }), ctx)).rejects.toMatchObject({ status: 400 });
  });

  it('POST provisions a user, maps to a SCIM payload and audits on the same transaction', async () => {
    const { POST } = await loadRoute();

    const result = await POST(
      provision({
        userName: 'jane@example.com',
        name: { givenName: 'Jane', familyName: 'Doe' },
        emails: [{ value: 'jane@example.com', primary: true }],
      }),
      ctx,
    );

    expect(result.id).toBe('m-new');
    expect(result.userName).toBe('jane@example.com');
    expect(result.name.formatted).toBe('Jane Doe');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'admin_1', action: 'scim.user.provision', resourceId: 'm-new' }),
    );
  });

  it('POST refuses to provision into another organization', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST(provision({ userName: 'jane@example.com' }), { ...ctx, params: { organizationId: 'org_2' } }),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST answers a conflict and writes no audit when the user already exists', async () => {
    const { POST } = await loadRoute();
    m.createdRows = [];

    await expect(POST(provision({ userName: 'jane@example.com' }), ctx)).rejects.toMatchObject({ status: 409 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST fails the provisioning when its audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(POST(provision({ userName: 'jane@example.com' }), ctx)).rejects.toThrow('audit unavailable');
  });

  // DEF-0B11-IDS-SCIM-LIST-INCLUDES-REMOVED-MEMBERS-AS-ACTIVE-AND-READS-THE-WHOLE-ROSTER-BEFORE-PAGING
  it('GET pages in SQL from the requested start index and reports the live total', async () => {
    const { GET } = await loadRoute();
    m.selectRows = [{ id: 'm1', userId: 'a', email: 'a@example.com', name: 'A B', status: 'active', joinedAt: null, createdAt: 'x', updatedAt: 'x' }];
    const result = await GET(new NextRequest('http://localhost/api/scim/v2/org_1/Users?startIndex=21&count=10'), ctx);
    expect(m.page).toEqual({ limit: 10, offset: 20 });
    expect(result.totalResults).toBe(1);
  });

  // DEF-0B11-IDS-SCIM-PROVISION-STORES-THE-USERNAME-STRING-AS-THE-USER-ID-AND-ACTIVATES-WITHOUT-ACCEPTANCE
  it('POST creates a pending membership: naming a user does not activate it', async () => {
    const { POST } = await loadRoute();
    await POST(provision({ userName: 'jane@example.com' }), ctx);
    expect(m.inserted).toMatchObject({ status: 'pending', role: 'member', organizationId: 'org_1' });
  });
});
