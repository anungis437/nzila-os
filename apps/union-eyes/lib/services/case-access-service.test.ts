import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const selectQueue: unknown[][] = [];

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => selectQueue.shift() ?? []),
    };
    return chain;
  };

  return {
    selectQueue,
    caseAssigneeEligible: vi.fn(async () => true),
    persistAtomicAudit: vi.fn(async () => undefined),
    db: {
      select: vi.fn(() => createSelectChain()),
      insert: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_ctx: unknown, fn: (tx: unknown) => unknown) => fn(m.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/cases/case-authorization', () => ({ caseAssigneeEligible: m.caseAssigneeEligible }));

describe('case-access-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue.length = 0;
  });

  it('grants full owner-only access only to the primary owner', async () => {
    m.selectQueue.push([{ unionRepId: 'outgoing-owner' }]);
    const { getEffectiveCaseAccess } = await import('./case-access-service');

    const access = await getEffectiveCaseAccess({
      organizationId: 'org-liuna-synthetic',
      grievanceId: 'matter-1',
      userId: 'outgoing-owner',
    });

    expect(access.canViewCase).toBe(true);
    expect(access.isPrimaryOwner).toBe(true);
    expect(access.canViewPrivateDocuments).toBe(true);
    expect(access.ownerOnly.canReassignPrimary).toBe(true);
    expect(access.ownerOnly.canExportSealedEvidence).toBe(true);
  });

  it('denies successor access when no active assignment exists', async () => {
    m.selectQueue.push([{ unionRepId: 'outgoing-owner' }], []);
    const { getEffectiveCaseAccess } = await import('./case-access-service');

    const access = await getEffectiveCaseAccess({
      organizationId: 'org-liuna-synthetic',
      grievanceId: 'matter-1',
      userId: 'former-successor',
    });

    expect(access.canViewCase).toBe(false);
    expect(access.isSecondaryCollaborator).toBe(false);
    expect(access.canViewPrivateDocuments).toBe(false);
    expect(access.ownerOnly.canReassignPrimary).toBe(false);
    expect(access.ownerOnly.canExportSealedEvidence).toBe(false);
  });

  it('allows active successor review without owner-only powers', async () => {
    m.selectQueue.push(
      [{ unionRepId: 'outgoing-owner' }],
      [{
        accessRole: 'reviewer',
        canComment: true,
        canUploadDocuments: false,
        canEditCaseNotes: false,
        canDraftActions: true,
        canViewPrivateDocuments: false,
      }],
    );
    const { getEffectiveCaseAccess } = await import('./case-access-service');

    const access = await getEffectiveCaseAccess({
      organizationId: 'org-liuna-synthetic',
      grievanceId: 'matter-1',
      userId: 'incoming-reviewer',
    });

    expect(access.canViewCase).toBe(true);
    expect(access.accessRole).toBe('reviewer');
    expect(access.canDraftActions).toBe(true);
    expect(access.canViewPrivateDocuments).toBe(false);
    expect(access.ownerOnly.canCloseCase).toBe(false);
    expect(access.ownerOnly.canExportSealedEvidence).toBe(false);
  });

  it('keeps the active-and-unexpired assignment predicate in source', () => {
    const source = readFileSync(resolve(__dirname, './case-access-service.ts'), 'utf8');

    expect(source).toContain("eq(grievanceCaseAccessAssignments.status, 'active')");
    expect(source).toContain('grievanceCaseAccessAssignments.expiresAt');
    expect(source).toContain('> NOW()');
  });
});

describe('case-access grant authority (P0-B)', () => {
  const baseGrant = {
    organizationId: 'org-1',
    grievanceId: 'matter-1',
    userId: 'grantee',
    grantedBy: 'owner',
    accessRole: 'reviewer' as const,
  };
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue.length = 0;
    m.caseAssigneeEligible.mockResolvedValue(true);
  });

  it('refuses a steward+ who is not the primary owner and writes nothing', async () => {
    m.selectQueue.push([{ unionRepId: 'someone-else' }]);
    const { grantCaseAccessGuarded } = await import('./case-access-service');

    const result = await grantCaseAccessGuarded({ ...baseGrant, grantedBy: 'chief-steward', userId: 'chief-steward', expiresAt: inDays(5), canViewPrivateDocuments: true });

    expect(result).toMatchObject({ ok: false, status: 403, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' });
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('returns not-found for a grievance outside the organization', async () => {
    m.selectQueue.push([]);
    const { grantCaseAccessGuarded } = await import('./case-access-service');
    const result = await grantCaseAccessGuarded({ ...baseGrant, expiresAt: inDays(5) });
    expect(result).toMatchObject({ ok: false, status: 404, code: 'CASE_NOT_FOUND' });
  });

  it('refuses owner self-grant and an ineligible grantee', async () => {
    const { grantCaseAccessGuarded } = await import('./case-access-service');

    m.selectQueue.push([{ unionRepId: 'owner' }]);
    expect(await grantCaseAccessGuarded({ ...baseGrant, userId: 'owner', expiresAt: inDays(5) }))
      .toMatchObject({ ok: false, code: 'SELF_GRANT_FORBIDDEN' });

    m.selectQueue.push([{ unionRepId: 'owner' }]);
    m.caseAssigneeEligible.mockResolvedValue(false);
    expect(await grantCaseAccessGuarded({ ...baseGrant, expiresAt: inDays(5) }))
      .toMatchObject({ ok: false, status: 400, code: 'GRANTEE_INELIGIBLE' });
    expect(m.db.insert).not.toHaveBeenCalled();
  });

  it('enforces expiry and role-scope terms', async () => {
    const { validateCaseAccessGrantTerms } = await import('./case-access-service');

    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer' })).toMatchObject({ code: 'EXPIRY_REQUIRED' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'secondary_lro', canViewPrivateDocuments: true })).toMatchObject({ code: 'EXPIRY_REQUIRED' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'secondary_lro' })).toBeNull();
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(-1) })).toMatchObject({ code: 'INVALID_EXPIRY' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(400) })).toMatchObject({ code: 'INVALID_EXPIRY' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'reviewer', expiresAt: inDays(10), canEditCaseNotes: true })).toMatchObject({ code: 'SCOPE_EXCEEDS_ROLE' });
    expect(validateCaseAccessGrantTerms({ accessRole: 'read_only', expiresAt: inDays(10) })).toBeNull();
  });

  it('refuses revocation by a non-owner and for an assignment of another case', async () => {
    const { revokeCaseAccessGuarded } = await import('./case-access-service');

    m.selectQueue.push([{ unionRepId: 'someone-else' }]);
    expect(await revokeCaseAccessGuarded({ organizationId: 'org-1', grievanceId: 'matter-1', assignmentId: 'a1', actorId: 'chief-steward' }))
      .toMatchObject({ ok: false, status: 403, code: 'CASE_MANAGEMENT_AUTHORITY_REQUIRED' });

    m.selectQueue.push([{ unionRepId: 'owner' }], []);
    expect(await revokeCaseAccessGuarded({ organizationId: 'org-1', grievanceId: 'matter-1', assignmentId: 'a-other', actorId: 'owner' }))
      .toMatchObject({ ok: false, status: 404, code: 'ASSIGNMENT_NOT_FOUND' });
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('grants access and writes the audit record inside the same transaction', async () => {
    m.selectQueue.push([{ unionRepId: 'owner' }], []);
    const created = { id: 'asg1', userId: 'grantee', accessRole: 'reviewer', status: 'active', canComment: true, canUploadDocuments: false, canEditCaseNotes: false, canDraftActions: false, canViewPrivateDocuments: false, expiresAt: null };
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [created]) })) });
    const { grantCaseAccessGuarded } = await import('./case-access-service');
    const result = await grantCaseAccessGuarded({ ...baseGrant, expiresAt: inDays(5) });
    expect(result).toMatchObject({ ok: true });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({
      action: 'case.access_granted', organizationId: 'org-1', userId: 'owner', resourceId: 'asg1',
    }));
  });

  it('does not return a grant when its audit record cannot be written', async () => {
    m.selectQueue.push([{ unionRepId: 'owner' }], []);
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'asg1', userId: 'grantee' }]) })) });
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit write failed'));
    const { grantCaseAccessGuarded } = await import('./case-access-service');
    await expect(grantCaseAccessGuarded({ ...baseGrant, expiresAt: inDays(5) })).rejects.toThrow('audit write failed');
  });

  it('revokes access and audits inside the same transaction', async () => {
    const before = { id: 'asg1', userId: 'grantee', status: 'active' };
    m.selectQueue.push([{ unionRepId: 'owner' }], [before]);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ ...before, status: 'revoked' }]) })) })) });
    const { revokeCaseAccessGuarded } = await import('./case-access-service');
    const result = await revokeCaseAccessGuarded({ organizationId: 'org-1', grievanceId: 'matter-1', assignmentId: 'asg1', actorId: 'owner' });
    expect(result).toMatchObject({ ok: true });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'case.access_revoked', resourceId: 'asg1' }));
  });
});
