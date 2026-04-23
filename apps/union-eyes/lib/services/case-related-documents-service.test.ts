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

const filterAuthorizedDocumentsForActor = vi.fn();

vi.mock('@/db/db', () => ({
  db: dbMock,
}));

vi.mock('@/lib/services/document-authorization-service', () => ({
  filterAuthorizedDocumentsForActor,
}));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('case-related-documents-service', () => {
  beforeEach(() => {
    dbMock.select.mockClear();
    filterAuthorizedDocumentsForActor.mockReset();
  });

  it('returns deterministic order for tied scores and always includes reasons', async () => {
    queueSelectSteps([
      {
        rows: [
          {
            id: 'case-1',
            grievantId: 'member-1',
            employerId: null,
            workplaceId: null,
            cbaId: null,
            unionRepId: 'lro-1',
            organizationId: 'org-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        rows: [
          {
            id: 'doc-b',
            title: 'Doc B',
            filename: null,
            name: 'Doc B',
            privacyLabel: 'team_confidential',
            documentType: 'memo',
            fileUrl: 'https://example.com/doc-b',
            updatedAt: new Date('2026-02-01T00:00:00.000Z'),
            linkedEntityType: 'grievance',
            linkedEntityId: 'case-1',
            tags: ['alpha'],
            uploadedBy: 'lro-1',
          },
          {
            id: 'doc-a',
            title: 'Doc A',
            filename: null,
            name: 'Doc A',
            privacyLabel: 'team_confidential',
            documentType: 'memo',
            fileUrl: 'https://example.com/doc-a',
            updatedAt: new Date('2026-02-01T00:00:00.000Z'),
            linkedEntityType: 'grievance',
            linkedEntityId: 'case-1',
            tags: ['alpha'],
            uploadedBy: 'lro-1',
          },
        ],
      },
      { rows: [] },
      { rows: [] },
    ]);

    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) => documents);

    const { getRelatedDocuments } = await import('./case-related-documents-service');

    const result = await getRelatedDocuments({
      caseId: 'case-1',
      orgId: 'org-1',
      actor: {
        userId: 'user-1',
        isStewardPlus: false,
      },
      limit: 10,
    });

    expect(result.map((doc) => doc.documentId)).toEqual(['doc-a', 'doc-b']);
    expect(result.every((doc) => doc.reasons.length > 0)).toBe(true);
  });

  it('ranks direct case links above same-member-only links', async () => {
    queueSelectSteps([
      {
        rows: [
          {
            id: 'case-2',
            grievantId: 'member-7',
            employerId: null,
            workplaceId: null,
            cbaId: null,
            unionRepId: 'lro-2',
            organizationId: 'org-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        rows: [
          {
            id: 'doc-direct',
            title: 'Direct',
            filename: null,
            name: 'Direct',
            privacyLabel: 'team_confidential',
            documentType: 'memo',
            fileUrl: 'https://example.com/direct',
            updatedAt: new Date('2026-02-02T00:00:00.000Z'),
            linkedEntityType: 'grievance',
            linkedEntityId: 'case-2',
            tags: [],
            uploadedBy: 'someone',
          },
          {
            id: 'doc-member',
            title: 'Member',
            filename: null,
            name: 'Member',
            privacyLabel: 'team_confidential',
            documentType: 'memo',
            fileUrl: 'https://example.com/member',
            updatedAt: new Date('2026-02-03T00:00:00.000Z'),
            linkedEntityType: 'member',
            linkedEntityId: 'member-7',
            tags: [],
            uploadedBy: 'someone',
          },
        ],
      },
      { rows: [] },
      { rows: [] },
    ]);

    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) => documents);

    const { getRelatedDocuments } = await import('./case-related-documents-service');

    const result = await getRelatedDocuments({
      caseId: 'case-2',
      orgId: 'org-1',
      actor: {
        userId: 'user-1',
        isStewardPlus: false,
      },
      limit: 10,
    });

    expect(result[0]?.documentId).toBe('doc-direct');
    expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 0);
  });

  it('excludes documents blocked by authorization filtering', async () => {
    queueSelectSteps([
      {
        rows: [
          {
            id: 'case-3',
            grievantId: 'member-8',
            employerId: null,
            workplaceId: null,
            cbaId: null,
            unionRepId: 'lro-3',
            organizationId: 'org-1',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      },
      {
        rows: [
          {
            id: 'doc-allowed',
            title: 'Allowed',
            filename: null,
            name: 'Allowed',
            privacyLabel: 'team_confidential',
            documentType: 'memo',
            fileUrl: 'https://example.com/allowed',
            updatedAt: new Date('2026-02-02T00:00:00.000Z'),
            linkedEntityType: 'grievance',
            linkedEntityId: 'case-3',
            tags: [],
            uploadedBy: 'someone',
          },
          {
            id: 'doc-blocked',
            title: 'Blocked',
            filename: null,
            name: 'Blocked',
            privacyLabel: 'privileged',
            documentType: 'memo',
            fileUrl: 'https://example.com/blocked',
            updatedAt: new Date('2026-02-02T00:00:00.000Z'),
            linkedEntityType: 'grievance',
            linkedEntityId: 'case-3',
            tags: [],
            uploadedBy: 'someone',
          },
        ],
      },
      { rows: [] },
      { rows: [] },
    ]);

    filterAuthorizedDocumentsForActor.mockImplementation(async ({ documents }) =>
      documents.filter((doc: { id: string }) => doc.id === 'doc-allowed'),
    );

    const { getRelatedDocuments } = await import('./case-related-documents-service');

    const result = await getRelatedDocuments({
      caseId: 'case-3',
      orgId: 'org-1',
      actor: {
        userId: 'user-1',
        isStewardPlus: false,
      },
      limit: 10,
    });

    expect(result.map((doc) => doc.documentId)).toEqual(['doc-allowed']);
  });
});
