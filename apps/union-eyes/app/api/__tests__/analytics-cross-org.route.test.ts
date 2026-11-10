import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY: the route used to aggregate every organization's analytics metrics for a platform_lead title (B89).
// Each organization's metrics are its own content (#1116, #1118) and no cross-organization grant exists, so it is refused for every caller
// and reads nothing: no system transaction, no select, no audit row of a read that did not happen.
const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  audit: vi.fn(),
  config: undefined as unknown,
}));

vi.mock('@/lib/api/with-api', () => ({
  withApi: vi.fn((config: unknown, handler: (...args: any[]) => unknown) => {
    m.config = config;
    return handler;
  }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }) } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext, withRLSContext: m.withRLSContext }));
vi.mock('@/db/db', () => ({ db: m.db }));

async function loadRoute() {
  return import('../analytics/cross-org/route');
}

describe('/api/analytics/cross-org route (refused)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the authenticated platform_lead floor, which is not itself authority', async () => {
    const { dynamic } = await loadRoute();
    expect(dynamic).toBe('force-dynamic');
    expect(m.config).toMatchObject({ auth: { required: true, minRole: 'platform_lead' } });
  });

  it.each([
    ['a platform lead acting in an organization', { userId: 'u1', organizationId: 'org1' }],
    ['a caller with no active organization', { userId: 'u1', organizationId: null }],
  ])('refuses %s with 403 and reads and audits nothing', async (_label, ctx) => {
    const { GET } = await loadRoute();
    await expect((GET as (c: unknown) => Promise<unknown>)(ctx)).rejects.toMatchObject({ status: 403, message: expect.stringContaining('no cross-organization grant exists') });
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });
});
