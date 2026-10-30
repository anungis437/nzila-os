import { beforeEach, describe, expect, it, vi } from 'vitest';
import { organizationMembers, organizations } from '@/db/schema-organizations';

const m = vi.hoisted(() => ({
  isPlatformAdminUser: vi.fn(),
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  isPlatformAdminUser: m.isPlatformAdminUser,
  ROLE_HIERARCHY: { member: 1, steward: 2, officer: 3, admin: 4, platform_lead: 5 },
}));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => false }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));

const orgA = '11111111-1111-4111-8111-111111111111';
const orgChild = '22222222-2222-4222-8222-222222222222';
const foreignOrg = '33333333-3333-4333-8333-333333333333';

function systemTransaction(memberships: Array<{ organizationId: string; role: string }>, descendants: Array<{ id: string }>) {
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(() =>
          table === organizationMembers
            ? Promise.resolve(memberships)
            : { limit: vi.fn().mockResolvedValue(descendants) },
        ),
      })),
    })),
  };
  return tx;
}

describe('organization read authority uses the explicit system transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.isPlatformAdminUser.mockResolvedValue(false);
  });

  it('uses transaction-bound membership and hierarchy queries, never a bare database handle', async () => {
    const tx = systemTransaction([{ organizationId: orgA, role: 'admin' }], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canReadOrganization, canAdministerOrganization } = await import('../read-authority');
    const access = await resolveOrganizationAccess('user-a');
    expect(m.withSystemContext).toHaveBeenCalledTimes(2);
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(canReadOrganization(access, orgA)).toBe(true);
    expect(canReadOrganization(access, orgChild)).toBe(true);
    expect(canAdministerOrganization(access, orgChild)).toBe(true);
    expect(canReadOrganization(access, foreignOrg)).toBe(false);
    expect(canAdministerOrganization(access, foreignOrg)).toBe(false);
  });

  it('does not query descendant organizations for a non-administrator', async () => {
    const tx = systemTransaction([{ organizationId: orgA, role: 'member' }], [{ id: orgChild }]);
    m.withSystemContext.mockImplementation(async (callback: (systemTx: typeof tx) => unknown) => callback(tx));
    const { resolveOrganizationAccess, canReadOrganization } = await import('../read-authority');
    const access = await resolveOrganizationAccess('user-a');
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(canReadOrganization(access, orgChild)).toBe(false);
  });

  it('fails closed when the membership transaction cannot be established', async () => {
    m.withSystemContext.mockRejectedValue(new Error('system database unavailable'));
    const { resolveOrganizationAccess } = await import('../read-authority');
    await expect(resolveOrganizationAccess('user-a')).rejects.toThrow('system database unavailable');
  });
});
