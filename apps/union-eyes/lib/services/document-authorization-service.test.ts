import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: unknown[];
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
      then: (onFulfilled: (value: unknown[]) => unknown, onRejected?: (reason: unknown) => unknown) =>
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

  it('allows privileged docs when explicit grant exists', async () => {
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
        isStewardPlus: false,
      },
      documents: [
        {
          id: 'doc-1',
          privacyLabel: 'privileged',
          linkedEntityType: 'grievance',
          linkedEntityId: 'case-1',
        },
      ],
    });

    expect(result[0]?.allowed).toBe(true);
    expect(result[0]?.reason).toBe('explicit_grant');
  });

  it('filters out case-restricted docs without case access', async () => {
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
        isStewardPlus: false,
      },
      documents: [
        {
          id: 'doc-2',
          privacyLabel: 'case_restricted',
          linkedEntityType: 'grievance',
          linkedEntityId: 'case-2',
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it('returns case_access reason for authorized collaborators', async () => {
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
        isStewardPlus: false,
      },
      documents: [
        {
          id: 'doc-3',
          privacyLabel: 'team_confidential',
          linkedEntityType: 'grievance',
          linkedEntityId: 'case-3',
        },
      ],
    });

    expect(result[0]?.allowed).toBe(true);
    expect(result[0]?.reason).toBe('case_access');
  });
});
