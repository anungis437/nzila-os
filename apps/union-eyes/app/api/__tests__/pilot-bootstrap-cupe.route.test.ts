import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  readFile: vi.fn(),
  withSystemContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  assertPilotDemoMutationRuntime: vi.fn(),
  apiConfig: undefined as any,
  selectQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    // The reset checks await .where(...) directly.
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  delete: vi.fn(() => ({
    where: vi.fn(() => Object.assign(Promise.resolve(undefined), { returning: async () => [{ id: 'removed' }] })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 'org_new' }]),
      onConflictDoNothing: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'inserted' }]) })),
    })),
  })),
};

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  RATE_LIMITS: { ORG_WRITE: 'ORG_WRITE' },
  z: {
    object: () => ({}),
    boolean: () => ({ default: () => ({}) }),
    string: () => ({ optional: () => ({}) }),
  },
  ApiError: {
    internal: (msg: string) => Object.assign(new Error(msg), { status: 500 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    unauthorized: () => Object.assign(new Error('Authentication required'), { status: 401 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
  },
}));
vi.mock('fs/promises', () => ({ readFile: m.readFile }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/config/pilot-demo-runtime', () => ({ assertPilotDemoMutationRuntime: m.assertPilotDemoMutationRuntime }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), inArray: vi.fn(() => 'in') };
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
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.assertPilotDemoMutationRuntime.mockReturnValue('pilot');
    m.withApi.mockImplementation(
      (cfg: unknown, handler: (ctx: any) => Promise<unknown>) => {
        m.apiConfig = cfg;
        return async (_request: NextRequest, ctx: any = { body: { reset: false, includeDemoScript: true }, userId: 'u1' }) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        };
      },
    );
  });

  const call = async (body: { reset: boolean; includeDemoScript: boolean; confirmReset?: string }, userId: string | null = 'u1') => {
    const { POST } = await loadRoute();
    return POST(new NextRequest('http://localhost/api/pilot/bootstrap/cupe', { method: 'POST' }), { body, userId });
  };

  it('is restricted to platform authority', async () => {
    await loadRoute();
    expect(m.apiConfig.auth).toEqual({ minRole: 'system_admin' });
  });

  it('creates org when missing and returns seeded summary, auditing on the same system transaction', async () => {
    m.selectQueue.push([], [{ itemId: 'org-seeded', completed: true }]);

    const response = await call({ reset: false, includeDemoScript: true });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.organizationId).toBe('org_new');
    expect(json.seeded.members).toBe(1);
    expect(json.seeded.worksites).toBe(0);
    expect(json.seeded.worksitesAvailableInFixtureNotSeeded).toBe(1);
    expect(json.onboarding).toEqual({ checklistInitialized: 1, completed: 1, pending: 6, total: 7 });
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        organizationId: 'org_new',
        userId: 'u1',
        action: 'pilot.bootstrap.cupe',
        details: expect.objectContaining({ reset: false, membersInserted: 1, casesInserted: 1, runtimeMode: 'pilot' }),
      }),
    );
  });

  describe('reset', () => {
    const existingOrg = () => m.selectQueue.push([{ id: 'org_existing' }], [{ id: 'bootstrap-marker' }]);

    it('removes only the seeded fixture rows of a demo organization and reports what it removed', async () => {
      existingOrg();
      m.selectQueue.push([{ userId: 'u1' }], [{ number: 'G-1' }], [{ itemId: 'org-seeded', completed: true }]);

      const response = await call({ reset: true, includeDemoScript: false, confirmReset: 'cupe-local-123' });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.reset).toBe(true);
      expect(json.demoScript).toHaveLength(0);
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ details: expect.objectContaining({ reset: true, removed: { grievances: 1, members: 1 } }) }),
      );
    });

    it('refuses an existing organization without a durable CUPE bootstrap marker', async () => {
      m.selectQueue.push([{ id: 'org_existing' }], []);
      const response = await call({ reset: true, includeDemoScript: false, confirmReset: 'cupe-local-123' });
      expect(response.status).toBe(409);
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('refuses a reset that does not name the organization, before touching the database', async () => {
      for (const confirmReset of [undefined, 'other-org', '']) {
        const response = await call({ reset: true, includeDemoScript: false, confirmReset });
        expect(response.status).toBe(400);
      }
      expect(m.withSystemContext).not.toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('refuses to reset an organization that holds a member the bootstrap did not seed', async () => {
      existingOrg();
      m.selectQueue.push([{ userId: 'u1' }, { userId: 'real-member' }], [{ number: 'G-1' }]);

      const response = await call({ reset: true, includeDemoScript: false, confirmReset: 'cupe-local-123' });

      expect(response.status).toBe(409);
      expect(mockDb.delete).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('refuses to reset an organization that holds a grievance the bootstrap did not seed', async () => {
      existingOrg();
      m.selectQueue.push([{ userId: 'u1' }], [{ number: 'G-1' }, { number: 'REAL-2026-001' }]);

      const response = await call({ reset: true, includeDemoScript: false, confirmReset: 'cupe-local-123' });

      expect(response.status).toBe(409);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  it('fails when the audit cannot be written, so nothing it seeded commits', async () => {
    m.selectQueue.push([]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    const response = await call({ reset: false, includeDemoScript: true });

    expect(response.status).toBe(500);
  });

  it('stays inert outside a pilot or demo runtime: no fixture read, no database access', async () => {
    m.assertPilotDemoMutationRuntime.mockImplementationOnce(() => {
      throw new Error('Demo data operations are disabled unless NZILA_MODE is set to pilot or demo');
    });

    const response = await call({ reset: true, includeDemoScript: true });

    expect(response.status).toBe(403);
    expect(m.readFile).not.toHaveBeenCalled();
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('refuses a caller with no resolved user', async () => {
    const response = await call({ reset: false, includeDemoScript: true }, null);

    expect(response.status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });
});
