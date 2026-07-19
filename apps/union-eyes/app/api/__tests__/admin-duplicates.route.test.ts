import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  auditLog: vi.fn(),
  selectQueue: [] as unknown[][],
}));

function makeChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
};

vi.mock('@/lib/api/framework', () => {
  const zString = { optional: () => zString, uuid: () => zString } as any;
  const zNumber = { int: () => zNumber, min: () => zNumber, max: () => zNumber, optional: () => zNumber, default: () => zNumber } as any;
  return {
    withApi: m.withApi,
    z: {
      object: () => ({}),
      string: () => zString,
      enum: () => ({ optional: () => ({}) }),
      coerce: { number: () => zNumber },
    },
    ApiError: {
      badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
      notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    },
  };
});

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { DATA_UPDATE: 'DATA_UPDATE' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    and: vi.fn(() => 'and'),
    desc: vi.fn(() => 'desc'),
    count: vi.fn(() => 1),
  };
});

async function loadRoute() {
  return import('../admin/duplicates/route');
}

describe('admin/duplicates route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'u1', query: {}, body: {} }) => {
          try {
            const raw = await request.json().catch(() => ({}));
            const data = await handler({ request, ...ctx, body: Object.keys(raw).length ? raw : ctx.body });
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('GET returns 400 when organization context is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/duplicates'), { query: {} });
    expect(response.status).toBe(400);
  });

  it('GET returns groups with expanded members', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ count: 1 }],
      [{ id: 'g1', autoScore: 0.8, createdAt: new Date('2026-01-01'), reviewedAt: null }],
      [{ id: 'm1', similarityScore: 0.95, createdAt: new Date('2026-01-01') }],
    );

    const response = await GET(new NextRequest('http://localhost/api/admin/duplicates'), {
      organizationId: 'org_1',
      query: { limit: 20, offset: 0 },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.total).toBe(1);
    expect(json.groups).toHaveLength(1);
    expect(json.groups[0].members).toHaveLength(1);
  });

  it('POST returns 400 when org context missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/duplicates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ group_id: 'g1', action: 'confirm' }),
    }), { userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST returns 404 when target group is not found', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);
    const response = await POST(new NextRequest('http://localhost/api/admin/duplicates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ group_id: 'g1', action: 'confirm' }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(404);
  });

  it('POST resolves duplicate group and audits action', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'g1', groupType: 'member', status: 'pending' }]);

    const response = await POST(new NextRequest('http://localhost/api/admin/duplicates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ group_id: 'g1', action: 'merge' }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('merged');
    expect(m.auditLog).toHaveBeenCalled();
  });
});
