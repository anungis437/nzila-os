import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { execute: vi.fn(async () => [{ cnt: 0, training_due: 0, last_dt: null }]) },
  withRLSContext: vi.fn(),
  sqlCalls: [] as Array<{ strings: TemplateStringsArray; values: unknown[] }>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
  z: require('zod'),
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    m.sqlCalls.push({ strings, values });
    return { strings, values };
  };
  return { ...actual, sql: Object.assign(sql, { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../health-safety/dashboard/route');
}

describe('health-safety/dashboard route (PR #752 round 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sqlCalls.length = 0;
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockImplementation(async () => [{ cnt: 0, training_due: 0, last_dt: null }]);
  });

  it('scopes every query to the auth-resolved organizationId, ignoring a client-supplied ?organizationId= query param', async () => {
    const { GET } = await loadRoute();

    await GET({
      request: {
        url: 'http://localhost/api/health-safety/dashboard?organizationId=org-attacker-supplied&period=30d',
      },
      organizationId: 'org-context-resolved',
    });

    const orgFilterCalls = m.sqlCalls.filter((c) => c.strings[0] === 'organization_id = ');
    expect(orgFilterCalls.length).toBeGreaterThan(0);
    for (const call of orgFilterCalls) {
      expect(call.values).toEqual(['org-context-resolved']);
    }
    expect(m.sqlCalls.some((c) => c.values.includes('org-attacker-supplied'))).toBe(false);
  });

  it('falls back to an unfiltered predicate (RLS-backed) when no organizationId is resolved from auth context', async () => {
    const { GET } = await loadRoute();

    await GET({
      request: { url: 'http://localhost/api/health-safety/dashboard' },
      organizationId: null,
    });

    const orgFilterCalls = m.sqlCalls.filter((c) => c.strings[0] === '1=1');
    expect(orgFilterCalls.length).toBeGreaterThan(0);
  });
});
