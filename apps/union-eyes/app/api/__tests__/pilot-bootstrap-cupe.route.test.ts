import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  readFile: vi.fn(),
  withSystemContext: vi.fn(),
  trackPilotEvent: vi.fn(),
  auditLog: vi.fn(),
  selectQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 'org_new' }]),
      onConflictDoNothing: vi.fn(async () => undefined),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ORG_WRITE: 'ORG_WRITE' },
  z: {
    object: () => ({}),
    boolean: () => ({ default: () => ({}) }),
  },
  ApiError: {
    internal: (msg: string) => Object.assign(new Error(msg), { status: 500 }),
  },
}));
vi.mock('fs/promises', () => ({ readFile: m.readFile }));
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/services/pilot-tracking', () => ({ trackPilotEvent: m.trackPilotEvent }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { DATA_CREATE: 'DATA_CREATE' },
  AuditSeverity: { HIGH: 'HIGH' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../pilot/bootstrap/cupe/route');
}

const fixture = {
  org: { name: 'CUPE Local', slug: 'cupe-local-123' },
  members: [{ id: 'u1', first_name: 'A', last_name: 'One', email: 'a@example.com', role: 'member', member_number: '1' }],
  cases: [{ number: 'G-1', case_type: 'wage_dispute', status: 'acknowledged', title: 'Case', description: 'Desc', filed_by: 'u1' }],
  worksites: [{ id: 'w1' }],
};

describe('pilot/bootstrap/cupe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.readFile.mockResolvedValue(JSON.stringify(fixture));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.trackPilotEvent.mockResolvedValue(undefined);
    m.auditLog.mockResolvedValue(undefined);
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_request: NextRequest, ctx: any = { body: { reset: false, includeDemoScript: true }, userId: 'u1' }) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('creates org when missing and returns seeded summary', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/pilot/bootstrap/cupe', { method: 'POST' }), {
      body: { reset: false, includeDemoScript: true },
      userId: 'u1',
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.organizationId).toBe('org_new');
    expect(json.seeded.members).toBe(1);
    expect(m.trackPilotEvent).toHaveBeenCalledTimes(2);
  });

  it('resets data for existing org when reset=true', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'org_existing' }]);

    const response = await POST(new NextRequest('http://localhost/api/pilot/bootstrap/cupe', { method: 'POST' }), {
      body: { reset: true, includeDemoScript: false },
      userId: 'u1',
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.reset).toBe(true);
    expect(json.demoScript).toHaveLength(0);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
