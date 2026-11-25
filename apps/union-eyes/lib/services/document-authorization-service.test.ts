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
const hasRoleInOrganization = vi.fn(async () => false);

vi.mock('@/db/db', () => ({
  db: dbMock,
}));

vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess,
}));

vi.mock('@/lib/api-auth-guard', () => ({
  hasRoleInOrganization,
}));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('document-authorization-service', () => {
  beforeEach(() => {
    dbMock.select.mockClear();
    getEffectiveCaseAccess.mockReset();
    hasRoleInOrganization.mockReset();
    hasRoleInOrganization.mockResolvedValue(false);
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
    queueSelectSteps([{ rows: [] }, { rows: [] }, { rows: [] }]);
    const { authorizeDocumentsForActor } = await import('./document-authorization-service');
    const result = await authorizeDocumentsForActor({ organizationId: 'org-1', actor: { userId: 'member' },
      documents: [{ id: 'library-doc', privacyLabel: 'public_internal', linkedEntityType: 'policy_library', linkedEntityId: 'library-1' }] });
    expect(result[0]?.allowed).toBe(true);
    expect(getEffectiveCaseAccess).not.toHaveBeenCalled();
  });


  describe('organization-level documents follow the rule the download applies', () => {
    const decide = async (document: Record<string, unknown>, options: { staff?: boolean; grant?: boolean; actor?: Record<string, unknown>; lookups?: number } = {}) => {
      queueSelectSteps([{ rows: options.grant ? [{ documentId: 'doc-1' }] : [] }, ...Array.from({ length: options.lookups ?? 0 }, () => ({ rows: [] }))]);
      hasRoleInOrganization.mockResolvedValue(Boolean(options.staff));
      const { authorizeDocumentsForActor } = await import('./document-authorization-service');
      const [result] = await authorizeDocumentsForActor({
        organizationId: 'org-1',
        actor: { userId: 'reader', ...options.actor },
        documents: [{ id: 'doc-1', linkedEntityType: null, linkedEntityId: null, ...document }],
      });
      return result?.allowed;
    };

    it('keeps another member\'s confidential document from an ordinary member', async () => {
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else' })).toBe(false);
      expect(await decide({ privacyLabel: 'case_restricted', uploadedBy: 'someone-else' })).toBe(false);
    });

    it('lets in the uploader, a representative, a grant holder, and everyone for a document shared with all members', async () => {
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'reader' })).toBe(true);
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else' }, { staff: true })).toBe(true);
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else' }, { grant: true })).toBe(true);
      expect(await decide({ privacyLabel: 'public_internal', uploadedBy: 'someone-else' })).toBe(true);
    });

    it('does not open a privileged document to a representative without a grant', async () => {
      expect(await decide({ privacyLabel: 'privileged', uploadedBy: 'someone-else' }, { staff: true })).toBe(false);
      expect(await decide({ privacyLabel: 'privileged', uploadedBy: 'reader' })).toBe(false);
      expect(await decide({ privacyLabel: 'privileged', uploadedBy: 'someone-else' }, { grant: true })).toBe(true);
    });

    it('takes seniority as given by the caller and never looks it up when it is stated', async () => {
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else' }, { actor: { isStaff: true } })).toBe(true);
      expect(hasRoleInOrganization).not.toHaveBeenCalled();
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else' }, { staff: true, actor: { isStaff: false } })).toBe(false);
    });

    it('never lets seniority open a case document, and judges a document linked to another record by the same rule', async () => {
      getEffectiveCaseAccess.mockResolvedValue({ canViewCase: false, canViewPrivateDocuments: false, isPrimaryOwner: false });
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else', linkedEntityType: 'grievance', linkedEntityId: 'case-1' }, { staff: true })).toBe(false);
      expect(await decide({ privacyLabel: 'team_confidential', uploadedBy: 'someone-else', linkedEntityType: 'member', linkedEntityId: 'member-1' }, { lookups: 2 })).toBe(false);
    });
  });
});
