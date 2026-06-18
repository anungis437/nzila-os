import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  auditLog: vi.fn(),
  selectQueue: [] as unknown[][],
  updateFailAt: -1,
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(async () => rows),
  };
  return chain;
}

let updateCount = 0;
const mockDb = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => {
        updateCount += 1;
        if (m.updateFailAt === updateCount) {
          throw new Error('update failed');
        }
      }),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => {
  const zString = { uuid: () => zString, optional: () => zString } as any;
  const zNumber = { int: () => zNumber, min: () => zNumber, max: () => zNumber, optional: () => zNumber, default: () => zNumber } as any;
  const zArray = { min: () => zArray, max: () => zArray, optional: () => zArray } as any;
  return {
    withApi: m.withApi,
    z: {
      object: () => ({}),
      string: () => zString,
      array: () => zArray,
      coerce: { number: () => zNumber },
      enum: () => ({ optional: () => ({}) }),
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
  AuditEventType: { DATA_BULK_UPDATE: 'DATA_BULK_UPDATE' },
  AuditSeverity: { MEDIUM: 'MEDIUM' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), inArray: vi.fn(() => 'inArray') };
});

async function loadRoute() {
  return import('../admin/ingest/retry/route');
}

describe('admin/ingest/retry route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateFailAt = -1;
    updateCount = 0;
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'u1', body: {} }) => {
          try {
            const raw = await request.json().catch(() => ({}));
            const data = await handler({ request, ...ctx, body: raw });
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditLog.mockResolvedValue(undefined);
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/ingest/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch_id: 'b1' }),
    }), { userId: 'u1' });
    expect(response.status).toBe(400);
  });

  it('POST returns 404 when batch does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);
    const response = await POST(new NextRequest('http://localhost/api/admin/ingest/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch_id: 'b1' }),
    }), { organizationId: 'org_1', userId: 'u1' });
    expect(response.status).toBe(404);
  });

  it('POST returns empty retry result when no failed records', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'batch_1' }], []);
    const response = await POST(new NextRequest('http://localhost/api/admin/ingest/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch_id: 'b1' }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.retried).toBe(0);
  });

  it('POST retries failed records and reports counts', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'batch_1' }], [{ id: 'r1' }, { id: 'r2' }]);

    const response = await POST(new NextRequest('http://localhost/api/admin/ingest/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch_id: 'b1', record_ids: ['r1', 'r2'] }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.retried).toBe(2);
    expect(json.succeeded).toBe(2);
    expect(m.auditLog).toHaveBeenCalled();
  });

  it('POST increments failed count when update errors occur', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'batch_1' }], [{ id: 'r1' }, { id: 'r2' }]);
    m.updateFailAt = 2;

    const response = await POST(new NextRequest('http://localhost/api/admin/ingest/retry', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batch_id: 'b1' }),
    }), { organizationId: 'org_1', userId: 'u1' });

    const json = await response.json();
    expect(json.failed).toBe(1);
    expect(json.succeeded).toBe(1);
  });
});
