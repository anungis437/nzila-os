import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  requireEntitlement: vi.fn(),
  selectQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(async () => rows),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@/lib/api/framework', () => {
  const zString = { uuid: () => zString, default: () => zString } as any;
  return {
    withApi: m.withApi,
    z: {
      object: () => ({}),
      string: () => zString,
      enum: () => ({ default: () => ({}) }),
    },
    ApiError: {
      badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
      notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    },
  };
});
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  PLATFORM_MODULES: { EMPLOYER_PAYROLL_OFFICIAL: 'EMPLOYER_PAYROLL_OFFICIAL' },
  requireEntitlement: m.requireEntitlement,
}));
vi.mock('../employer-execution/_lib', () => ({
  calculatePayroll: vi.fn(),
  resolvePayrollRules: vi.fn(),
  sha256: vi.fn(),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    asc: vi.fn(() => 'asc'),
    desc: vi.fn(() => 'desc'),
    eq: vi.fn(() => 'eq'),
    gte: vi.fn(() => 'gte'),
    isNull: vi.fn(() => 'isNull'),
    lte: vi.fn(() => 'lte'),
    or: vi.fn(() => 'or'),
  };
});

async function loadRoute() {
  return import('../employer-execution/payroll-runs/route');
}

describe('employer-execution/payroll-runs route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.requireEntitlement.mockResolvedValue(undefined);
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (request: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'u1', body: {} }) => {
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

    const response = await GET(new NextRequest('http://localhost/api/employer-execution/payroll-runs'), { organizationId: null });
    expect(response.status).toBe(400);
  });

  it('GET returns payroll runs list', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([{ id: 'pr1' }]);

    const response = await GET(new NextRequest('http://localhost/api/employer-execution/payroll-runs'), { organizationId: 'org_1' });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
  });

  it('POST returns 404 when source timesheet batch is missing', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/employer-execution/payroll-runs', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        timesheetBatchId: '11111111-1111-1111-1111-111111111111', periodStart: '2026-01-01', periodEnd: '2026-01-31', runType: 'preview', engineVersion: 'v1',
      }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(404);
  });

  it('POST returns 400 when no valid timesheet entries are found', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'batch_1', worksiteId: null, bargainingUnitId: null, employerId: null, sourceFileHash: 'h' }], []);

    const response = await POST(new NextRequest('http://localhost/api/employer-execution/payroll-runs', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        timesheetBatchId: '11111111-1111-1111-1111-111111111111', periodStart: '2026-01-01', periodEnd: '2026-01-31', runType: 'preview', engineVersion: 'v1',
      }),
    }), { organizationId: 'org_1', userId: 'u1' });

    expect(response.status).toBe(400);
  });
});
