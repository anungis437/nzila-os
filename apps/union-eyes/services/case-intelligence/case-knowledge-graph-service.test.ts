import { beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: any[];
};

const selectSteps: SelectStep[] = [];
const getRelatedDocuments = vi.fn();

const dbMock = {
  select: vi.fn(() => {
    const step = selectSteps.shift();
    if (!step) {
      throw new Error('No mocked select step configured');
    }

    const builder: Record<string, (...args: any[]) => unknown> = {
      from: () => builder,
      where: () => builder,
      limit: async () => step.rows,
      then: (onFulfilled: (value: any[]) => unknown, onRejected?: (reason: any) => unknown) =>
        Promise.resolve(step.rows).then(onFulfilled, onRejected),
    };

    return builder;
  }),
};

vi.mock('@/db/db', () => ({ db: dbMock }));
vi.mock('@/services/case-intelligence/related-documents-service', () => ({ getRelatedDocuments }));
vi.mock('@/db/schema/domains/claims/grievances', () => ({
  grievances: new Proxy({}, { get: (_t, name) => ({ name }) }),
}));
vi.mock('@/db/schema/domains/agreements/collective-agreements', () => ({
  collectiveAgreements: new Proxy({}, { get: (_t, name) => ({ name }) }),
}));
vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: new Proxy({}, { get: (_t, name) => ({ name }) }),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('case-intelligence case-knowledge-graph-service', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock.select.mockClear();
    getRelatedDocuments.mockReset();
  });

  it('returns an empty graph when the case cannot be found', async () => {
    queueSelectSteps([{ rows: [] }]);

    const { buildCaseGraph } = await import('./case-knowledge-graph-service');
    const result = await buildCaseGraph({
      context: { caseId: 'missing-case', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
    });

    expect(result).toEqual({ nodes: [], edges: [] });
    expect(getRelatedDocuments).not.toHaveBeenCalled();
  });

  it('builds nodes and edges for case, member, lro, agreement, employer, worksite, and documents', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-1',
          grievanceNumber: 'G-100',
          title: 'Termination dispute',
          grievantId: 'member-1',
          unionRepId: 'lro-1',
          cbaId: 'agreement-1',
          employerId: 'employer-1',
          employerName: 'Acme Corp',
          workplaceId: 'worksite-1',
          workplaceName: 'Main Plant',
          cbaArticle: '12',
          organizationId: 'org-1',
        }],
      },
      { rows: [{ userId: 'member-1', name: 'Jane Member' }] },
      { rows: [{ id: 'agreement-1', title: 'Master Agreement' }] },
    ]);
    getRelatedDocuments.mockResolvedValue([
      {
        documentId: 'doc-1',
        title: 'Award memo',
        privacyLabel: 'team_confidential',
        reasons: ['Same agreement'],
        finalScore: 88,
        linkedEntities: ['member:member-1', 'employer:employer-1', 'malformed', ':missing-type'],
      },
    ]);

    const { buildCaseGraph } = await import('./case-knowledge-graph-service');
    const result = await buildCaseGraph({
      context: { caseId: 'case-1', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
    });

    const nodeById = new Map(result.nodes.map((node) => [node.id, node]));
    expect(nodeById.get('case:case-1')?.label).toBe('G-100');
    expect(nodeById.get('member:member-1')?.label).toBe('Jane Member');
    expect(nodeById.get('lro:lro-1')).toBeDefined();
    expect(nodeById.get('agreement:agreement-1')?.label).toBe('Master Agreement');
    expect(nodeById.get('employer:employer-1')?.label).toBe('Acme Corp');
    expect(nodeById.get('worksite:worksite-1')?.label).toBe('Main Plant');
    expect(nodeById.get('document:doc-1')?.label).toBe('Award memo');

    const edgeTypes = new Set(result.edges.map((edge) => edge.type));
    expect(edgeTypes).toContain('case_member');
    expect(edgeTypes).toContain('case_lro');
    expect(edgeTypes).toContain('case_agreement');
    expect(edgeTypes).toContain('case_employer');
    expect(edgeTypes).toContain('case_worksite');
    expect(edgeTypes).toContain('case_document');
    expect(edgeTypes).toContain('document_employer');

    // Malformed linked entities are skipped.
    expect(result.nodes.some((node) => node.id.startsWith('malformed'))).toBe(false);
  });

  it('uses fallback labels and identifiers when related rows are missing', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-2',
          grievanceNumber: null,
          title: 'Discipline file',
          grievantId: 'member-2',
          unionRepId: null,
          cbaId: 'agreement-2',
          employerId: null,
          employerName: 'Standalone Employer',
          workplaceId: null,
          workplaceName: 'Remote Site',
          cbaArticle: null,
          organizationId: 'org-1',
        }],
      },
      { rows: [] },
      { rows: [] },
    ]);
    getRelatedDocuments.mockResolvedValue([]);

    const { buildCaseGraph } = await import('./case-knowledge-graph-service');
    const result = await buildCaseGraph({
      context: { caseId: 'case-2', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
    });

    const nodeById = new Map(result.nodes.map((node) => [node.id, node]));
    expect(nodeById.get('case:case-2')?.label).toBe('Discipline file');
    expect(nodeById.get('member:member-2')?.label).toBe('member-2');
    expect(nodeById.get('agreement:agreement-2')?.label).toBe('agreement-2');
    expect(nodeById.get('employer:Standalone Employer')?.label).toBe('Standalone Employer');
    expect(nodeById.get('worksite:Remote Site')?.label).toBe('Remote Site');
  });
});
