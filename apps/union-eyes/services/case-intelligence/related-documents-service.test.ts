import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: any[];
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
      then: (onFulfilled: (value: any[]) => unknown, onRejected?: (reason: any) => unknown) =>
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

describe('case-intelligence related-documents-service', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock.select.mockClear();
    filterAuthorizedDocumentsForActor.mockReset();
    isFeatureEnabled.mockReset();
    isFeatureEnabled.mockResolvedValue(false);
    delete process.env.FEATURE_CASE_INTELLIGENCE_V1_ML;
  });

  afterEach(() => {
    delete process.env.FEATURE_CASE_INTELLIGENCE_V1_ML;
  });

  it('filters unauthorized docs before ranking and keeps reasons', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-1', grievanceNumber: 'G-1', title: 'Termination dispute', description: 'Member terminated',
          type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', employerName: 'Employer',
          workplaceId: 'worksite-1', workplaceName: 'Plant', cbaId: 'agreement-1', cbaArticle: '5', unionRepId: 'lro-1',
          createdBy: 'user-9', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-01-01T00:00:00Z')
        }],
      },
      {
        rows: [
          {
            id: 'doc-allowed', title: 'Allowed', filename: null, name: 'Allowed', privacyLabel: 'team_confidential',
            documentType: 'memo', fileUrl: 'https://example.com/allowed', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-1', tags: ['termination'], uploadedBy: 'lro-1',
          },
          {
            id: 'doc-blocked', title: 'Blocked', filename: null, name: 'Blocked', privacyLabel: 'privileged',
            documentType: 'memo', fileUrl: 'https://example.com/blocked', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-1', tags: ['termination'], uploadedBy: 'lro-1',
          },
        ],
      },
      { rows: [] },
      { rows: [{ userId: 'lro-1' }] },
    ]);
    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) =>
      documents.filter((doc: { id: string }) => doc.id === 'doc-allowed'),
    );

    const { getRelatedDocuments } = await import('./related-documents-service');
    const result = await getRelatedDocuments({
      context: { caseId: 'case-1', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
      limit: 10,
    });

    expect(result.map((doc) => doc.documentId)).toEqual(['doc-allowed']);
    expect(result[0]?.reasons.length).toBeGreaterThan(0);
  });

  it('keeps deterministic ordering when scores tie', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-2', grievanceNumber: 'G-2', title: 'Discipline file', description: 'Discipline issue',
          type: 'discipline', status: 'new', grievantId: 'member-2', employerId: null, employerName: null,
          workplaceId: null, workplaceName: null, cbaId: null, cbaArticle: null, unionRepId: 'lro-2',
          createdBy: 'user-9', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-01-01T00:00:00Z')
        }],
      },
      {
        rows: [
          {
            id: 'doc-b', title: 'Doc B', filename: null, name: 'Doc B', privacyLabel: 'team_confidential',
            documentType: 'memo', fileUrl: 'https://example.com/b', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-2', tags: ['discipline'], uploadedBy: 'lro-2',
          },
          {
            id: 'doc-a', title: 'Doc A', filename: null, name: 'Doc A', privacyLabel: 'team_confidential',
            documentType: 'memo', fileUrl: 'https://example.com/a', updatedAt: new Date('2026-02-01T00:00:00Z'),
            linkedEntityType: 'grievance', linkedEntityId: 'case-2', tags: ['discipline'], uploadedBy: 'lro-2',
          },
        ],
      },
      { rows: [] },
      { rows: [{ userId: 'lro-2' }] },
    ]);
    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) => documents);

    const { getRelatedDocuments } = await import('./related-documents-service');
    const result = await getRelatedDocuments({
      context: { caseId: 'case-2', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
      limit: 10,
    });

    expect(result.map((doc) => doc.documentId)).toEqual(['doc-a', 'doc-b']);
  });
});
