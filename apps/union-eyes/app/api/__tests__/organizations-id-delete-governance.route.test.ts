import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B9-ORG-ITEM-DELETE-ORGANIZATION-ADMIN-ARCHIVES-OWN-ORGANIZATION-BYPASSING-STATUS-GOVERNANCE
// DELETE must never archive: a local administrator is refused, and even platform governance gets no direct archive.

const ORG = '11111111-1111-4111-8111-111111111111';
const m = vi.hoisted(() => ({
  requireUserForOrganization: vi.fn(),
  requireSystemAdmin: vi.fn(),
  update: vi.fn(),
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: 'user-1' }) }));
vi.mock('@/db/db', () => ({ db: { update: m.update, select: vi.fn(), execute: vi.fn() } }));
vi.mock('@/db/schema-organizations', () => ({ organizations: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => unknown)({ update: m.update }),
  withSystemContext: async (fn: (tx: unknown) => unknown) => fn({ update: m.update }),
}));
vi.mock('@/lib/api-auth-guard', () => ({
  requireUserForOrganization: m.requireUserForOrganization,
  requireSystemAdmin: m.requireSystemAdmin,
  ROLE_HIERARCHY: { member: 20, admin: 140 },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/organizations/read-authority', () => ({
  canAdministerOrganization: () => true, canReadOrganization: () => true, resolveOrganizationAccess: async () => ({}),
}));

const call = async (id = ORG) => {
  const { DELETE } = await import('../organizations/[id]/route');
  return DELETE(new NextRequest(`http://localhost/api/organizations/${id}`, { method: 'DELETE' }), { params: Promise.resolve({ id }) });
};

describe('DELETE /api/organizations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireUserForOrganization.mockResolvedValue({ userId: 'user-1', roles: ['admin'] });
    m.requireSystemAdmin.mockRejectedValue(new Error('not a platform administrator'));
  });

  it('refuses the organization\'s own administrator, and writes nothing', async () => {
    const response = await call();
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain('platform governance');
    expect(m.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses a caller who is not an administrator of it', async () => {
    m.requireUserForOrganization.mockResolvedValue({ userId: 'user-1', roles: ['member'] });
    expect((await call()).status).toBe(403);
    m.requireUserForOrganization.mockRejectedValue(new Error('not a member'));
    expect((await call()).status).toBe(403);
    expect(m.update).not.toHaveBeenCalled();
  });

  it('gives even a platform administrator no direct archive: 501, and writes nothing', async () => {
    m.requireSystemAdmin.mockResolvedValue({ userId: 'platform-1' });
    const response = await call();
    expect(response.status).toBe(501);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses a malformed identifier before any authority check', async () => {
    expect((await call('current')).status).toBe(400);
    expect(m.requireUserForOrganization).not.toHaveBeenCalled();
  });
});
