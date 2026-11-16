import { beforeEach, describe, expect, it, vi } from 'vitest';
const list = vi.hoisted(() => vi.fn());
vi.mock('@nzila/platform-auth/invites', () => ({ listOrganizationInvites: list }));
vi.mock('@/lib/audit/audit-reader', () => ({ hasAuditedAction: vi.fn() }));
import { verifyChecklistStep } from '../onboarding-checklist-evidence';
import type { RLSTx } from '@/lib/db/with-rls-context';
const tx = {} as RLSTx;
const invite = { role: 'member', acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 86_400_000) };
beforeEach(() => { list.mockReset(); list.mockResolvedValue([]); });

describe('setup evidence uses the invitation authority', () => {
  it('does not treat unrelated directory rows as invitations or staff acceptance', async () => {
    expect((await verifyChecklistStep(tx, 'org-a', 'admin-a', 'users-invited')).ok).toBe(false);
    expect(list).toHaveBeenCalledWith('admin-a', 'org-a');
    list.mockResolvedValue([invite]);
    expect((await verifyChecklistStep(tx, 'org-a', 'admin-a', 'users-invited')).ok).toBe(true);
    expect((await verifyChecklistStep(tx, 'org-a', 'admin-a', 'roles-assigned')).ok).toBe(false);
    list.mockResolvedValue([{ ...invite, role: 'steward', acceptedAt: new Date() }]);
    expect(await verifyChecklistStep(tx, 'org-a', 'admin-a', 'roles-assigned')).toEqual({ ok: true, evidence: { acceptedStaffInvitations: 1 } });
  });
  it('does not count revoked or expired unaccepted links', async () => {
    list.mockResolvedValue([{ ...invite, revokedAt: new Date() }, { ...invite, expiresAt: new Date(0) }]);
    expect((await verifyChecklistStep(tx, 'org-a', 'admin-a', 'users-invited')).ok).toBe(false);
  });
});
