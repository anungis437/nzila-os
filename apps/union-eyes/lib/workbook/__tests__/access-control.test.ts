import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

async function loadModule() {
  return import('../access-control');
}

// ROUND 50 REGRESSION: once a workbook is claimed, its identity-linked
// child data (memory holders etc.) must require claimant/same-org access
// — the workbookId bearer credential is no longer sufficient. Previously
// app/api/workbook/[id]/memory-holders/route.ts and its [holderId] PATCH/
// DELETE sibling only checked workbook existence, letting anyone who ever
// held the (pre-claim) workbookId keep reading/editing succession data
// forever, even after it became identity-linked.
describe('verifyClaimedWorkbookAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
  });

  it('returns 404 when the workbook does not exist', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([]);

    const result = await verifyClaimedWorkbookAccess('missing');

    expect(result).toEqual({ ok: false, status: 404, error: 'Workbook not found' });
  });

  it('allows access to an unclaimed workbook via the bearer id alone (pseudonymous by design)', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([{ id: 'w1', claimedByUserId: null }]);

    const result = await verifyClaimedWorkbookAccess('w1');

    expect(result).toEqual({ ok: true });
    expect(m.auth).not.toHaveBeenCalled();
  });

  it('returns 401 for a claimed workbook when the caller is unauthenticated', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1' }]);
    m.auth.mockResolvedValueOnce({ userId: null });

    const result = await verifyClaimedWorkbookAccess('w1');

    expect(result).toEqual({ ok: false, status: 401, error: 'Authentication required' });
  });

  it('allows access when the caller is the claimant', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1' }]);
    m.auth.mockResolvedValueOnce({ userId: 'owner_1' });

    const result = await verifyClaimedWorkbookAccess('w1');

    expect(result).toEqual({ ok: true });
  });

  it('allows access when the caller shares the claimant organization', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1' }]);
    m.auth.mockResolvedValueOnce({ userId: 'coworker_1' });
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_shared');

    const result = await verifyClaimedWorkbookAccess('w1');

    expect(result).toEqual({ ok: true });
  });

  it('returns 403 when the caller is a different user in a different organization (cross-tenant IDOR regression)', async () => {
    const { verifyClaimedWorkbookAccess } = await loadModule();
    m.selectQueue.push([{ id: 'w1', claimedByUserId: 'owner_1' }]);
    m.auth.mockResolvedValueOnce({ userId: 'attacker_1' });
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_attacker');
    m.getOrganizationIdForUser.mockResolvedValueOnce('org_owner');

    const result = await verifyClaimedWorkbookAccess('w1');

    expect(result).toEqual({ ok: false, status: 403, error: 'Forbidden' });
  });
});
