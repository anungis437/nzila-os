import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: unknown[];
};

const selectSteps: SelectStep[] = [];
const filterAuthorizedDocumentsForActor = vi.fn();
const isFeatureEnabled = vi.fn();

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

vi.mock('@/db/db', () => ({ db: dbMock }));
vi.mock('@/lib/services/document-authorization-service', () => ({ filterAuthorizedDocumentsForActor }));
vi.mock('@/lib/services/feature-flags-service', () => ({ isFeatureEnabled }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('case-intelligence precedent-matching-service', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock.select.mockClear();
    filterAuthorizedDocumentsForActor.mockReset();
    isFeatureEnabled.mockReset();
    isFeatureEnabled.mockResolvedValue(false);
  });

  it('returns only authorized precedent documents and includes reasons', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-root', title: 'Termination case', description: 'Termination issue', grievantId: 'member-1', employerId: 'employer-1',
          workplaceId: 'worksite-1', cbaId: 'agreement-1', unionRepId: 'lro-1', awardSummary: null, organizationId: 'org-1'
        }],
      },
      {
        rows: [
          {
            id: 'doc-safe', title: 'Safe precedent', filename: null, name: 'Safe precedent', privacyLabel: 'team_confidential',
            documentType: 'award', fileUrl: 'https://example.com/safe', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-similar', tags: ['precedent'], uploadedBy: 'lro-1',
          },
          {
            id: 'doc-hidden', title: 'Hidden precedent', filename: null, name: 'Hidden precedent', privacyLabel: 'privileged',
            documentType: 'award', fileUrl: 'https://example.com/hidden', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-similar', tags: ['precedent'], uploadedBy: 'lro-1',
          },
        ],
      },
    ]);
    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) =>
      documents.filter((doc: { id: string }) => doc.id === 'doc-safe'),
    );

    const { findPrecedentDocuments } = await import('./precedent-matching-service');
    const result = await findPrecedentDocuments({
      context: { caseId: 'case-root', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
      similarCases: [{ caseId: 'case-similar', score: 70, matchReasons: ['Same agreement'], matchedDimensions: { agreement: true } }],
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.documentId).toBe('doc-safe');
    expect(result[0]?.reasons.length).toBeGreaterThan(0);
  });
});
