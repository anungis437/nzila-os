import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: Record<string, unknown>[];
};

const selectSteps: SelectStep[] = [];

const dbMock = {
  select: vi.fn(() => {
    const step = selectSteps.shift();
    if (!step) {
      throw new Error('No mocked select step configured');
    }

    const builder = {
      from: () => builder,
      leftJoin: () => builder,
      orderBy: () => builder,
      where: () => builder,
      limit: async () => step.rows,
      then: (onFulfilled: (value: Record<string, unknown>[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(step.rows).then(onFulfilled, onRejected),
    };

    return builder;
  }),
};

const getEffectiveCaseAccess = vi.fn();

vi.mock('@/db/db', () => ({
  db: dbMock,
}));

vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess,
}));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('document-authorization-service', () => {
  beforeEach(() => {
    dbMock.select.mockClear();
    getEffectiveCaseAccess.mockReset();
  });

  it.each(['case', 'grievance'])('allows privileged %s documents only with both the grant and live case access', async (linkType) => {
    queueSelectSteps([{ rows: [{ documentId: 'doc-1' }] }]);
    getEffectiveCaseAccess.mockResolvedValue({
      canViewCase: true,
      canViewPrivateDocuments: false,
      isPrimaryOwner: false,
    });

    const { authorizeDocumentsForActor } = await import('./document-authorization-service');

    const result = await authorizeDocumentsForActor({
      organizationId: 'org-1',
      actor: {
        userId: 'user-1',
      },
      documents: [
        {
          id: 'doc-1',
          privacyLabel: 'privileged',
          linkedEntityType: linkType,
          linkedEntityId: 'case-1',
        },
      ],
    });

    expect(result[0]?.allowed).toBe(true);
    expect(result[0]?.reason).toBe('explicit_grant');
  });

  it.each(['case', 'grievance'])('filters out %s-restricted docs without case access', async (linkType) => {
    queueSelectSteps([{ rows: [] }]);
    getEffectiveCaseAccess.mockResolvedValue({
      canViewCase: false,
      canViewPrivateDocuments: false,
      isPrimaryOwner: false,
    });

    const { filterAuthorizedDocumentsForActor } = await import('./document-authorization-service');

    const result = await filterAuthorizedDocumentsForActor({
      organizationId: 'org-1',
      actor: {
        userId: 'user-2',
      },
      documents: [
        {
          id: 'doc-2',
          privacyLabel: 'case_restricted',
          linkedEntityType: linkType,
          linkedEntityId: 'case-2',
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it.each(['case', 'grievance'])('returns case_access for authorized collaborators under the %s link', async (linkType) => {
    queueSelectSteps([{ rows: [] }]);
    getEffectiveCaseAccess.mockResolvedValue({
      canViewCase: true,
      canViewPrivateDocuments: false,
      isPrimaryOwner: false,
    });

    const { authorizeDocumentsForActor } = await import('./document-authorization-service');

    const result = await authorizeDocumentsForActor({
      organizationId: 'org-1',
      actor: {
        userId: 'user-3',
      },
      documents: [
        {
          id: 'doc-3',
          privacyLabel: 'team_confidential',
          linkedEntityType: linkType,
          linkedEntityId: 'case-3',
        },
      ],
    });

    expect(result[0]?.allowed).toBe(true);
    expect(result[0]?.reason).toBe('case_access');
  });
  it.each(['case', 'grievance'])('does not let a processing/view grant restore a lost %s relationship', async (linkType) => {
    queueSelectSteps([{ rows: [{ documentId: 'revoked-doc' }] }]);
    getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false, isPrimaryOwner: false, canViewPrivateDocuments: false });
    const { authorizeDocumentsForActor } = await import('./document-authorization-service');
    const result = await authorizeDocumentsForActor({ organizationId: 'org-1', actor: { userId: 'former-handler' },
      documents: [{ id: 'revoked-doc', privacyLabel: 'public_internal', linkedEntityType: linkType, linkedEntityId: 'case-1' }] });
    expect(result[0]?.allowed).toBe(false);
    expect(getEffectiveCaseAccess).toHaveBeenCalledWith({ organizationId: 'org-1', grievanceId: 'case-1', userId: 'former-handler' });
  });

  it.each([
    ['case', null], ['grievance', null], ['unknown', 'case-1'], [null, 'case-1'], ['unknown', null],
  ])('fails closed on malformed type/id %s/%s even with an explicit grant', async (linkedEntityType, linkedEntityId) => {
    queueSelectSteps([{ rows: [{ documentId: 'broken-doc' }] }]);
    const { authorizeDocumentsForActor } = await import('./document-authorization-service');
    const result = await authorizeDocumentsForActor({ organizationId: 'org-1', actor: { userId: 'user-1' },
      documents: [{ id: 'broken-doc', privacyLabel: 'public_internal', linkedEntityType, linkedEntityId }] });
    expect(result[0]?.allowed).toBe(false);
    expect(getEffectiveCaseAccess).not.toHaveBeenCalled();
  });

  it('preserves a legacy case boundary under a recognized non-case spelling', async () => {
    queueSelectSteps([{ rows: [{ documentId: 'legacy-doc' }] }, { rows: [{ id: 'case-1' }] }]);
    getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false, isPrimaryOwner: false, canViewPrivateDocuments: false });
    const { authorizeDocumentsForActor } = await import('./document-authorization-service');
    const result = await authorizeDocumentsForActor({ organizationId: 'org-1', actor: { userId: 'office-user' },
      documents: [{ id: 'legacy-doc', privacyLabel: 'public_internal', linkedEntityType: 'policy_library', linkedEntityId: 'case-1' }] });
    expect(result[0]?.allowed).toBe(false);
    expect(getEffectiveCaseAccess).toHaveBeenCalledWith({ organizationId: 'org-1', grievanceId: 'case-1', userId: 'office-user' });
  });

  it('keeps an actual non-case policy-library document in organization scope', async () => {
    queueSelectSteps([{ rows: [] }, { rows: [] }]);
    const { authorizeDocumentsForActor } = await import('./document-authorization-service');
    const result = await authorizeDocumentsForActor({ organizationId: 'org-1', actor: { userId: 'member' },
      documents: [{ id: 'library-doc', privacyLabel: 'public_internal', linkedEntityType: 'policy_library', linkedEntityId: 'library-1' }] });
    expect(result[0]?.allowed).toBe(true);
    expect(getEffectiveCaseAccess).not.toHaveBeenCalled();
  });

});
