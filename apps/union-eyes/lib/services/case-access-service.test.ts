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
    db: {
      select: vi.fn(() => createSelectChain()),
    },
  };
});

vi.mock('@/db/db', () => ({ db: m.db }));

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
