import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SelectStep = {
  rows: any[];
  directWhere?: boolean;
};

const selectSteps: SelectStep[] = [];
const getEffectiveCaseAccess = vi.fn();
const isFeatureEnabled = vi.fn();

const dbMock = {
  select: vi.fn(() => {
    const step = selectSteps.shift();
    if (!step) {
      throw new Error('No mocked select step configured');
    }

    const builder: Record<string, (...args: any[]) => unknown> = {
      from: () => builder,
      orderBy: () => builder,
      limit: async () => step.rows,
      where: () => (step.directWhere ? Promise.resolve(step.rows) : builder),
    };

    return builder;
  }),
};

vi.mock('@/db/db', () => ({ db: dbMock }));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess }));
vi.mock('@/lib/services/feature-flags-service', () => ({ isFeatureEnabled }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

function queueSelectSteps(steps: SelectStep[]) {
  selectSteps.length = 0;
  selectSteps.push(...steps);
}

describe('case-intelligence case-pattern-detection-service', () => {
  beforeEach(() => {
    vi.resetModules();
    dbMock.select.mockClear();
    getEffectiveCaseAccess.mockReset();
    isFeatureEnabled.mockReset();
    isFeatureEnabled.mockResolvedValue(true);
    process.env.FEATURE_CASE_INTELLIGENCE_V1_PATTERNS = 'true';
  });

  afterEach(() => {
    delete process.env.FEATURE_CASE_INTELLIGENCE_V1_PATTERNS;
  });

  it('returns only authorized similar cases with matched dimensions', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-root', grievanceNumber: 'G-100', title: 'Termination', description: 'Termination dispute',
          type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', workplaceId: 'worksite-1',
          cbaId: 'agreement-1', createdBy: 'user-9', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-01-01T00:00:00Z')
        }],
      },
      {
        rows: [
          {
            id: 'case-allowed', grievanceNumber: 'G-101', title: 'Termination follow-up', description: 'Termination dispute with same employer',
            type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', workplaceId: 'worksite-1',
            cbaId: 'agreement-1', createdBy: 'user-2', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-02-01T00:00:00Z')
          },
          {
            id: 'case-blocked', grievanceNumber: 'G-102', title: 'Blocked case', description: 'Looks similar but not visible',
            type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', workplaceId: 'worksite-1',
            cbaId: 'agreement-1', createdBy: 'other-user', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-02-01T00:00:00Z')
          },
        ],
      },
    ]);
    getEffectiveCaseAccess
      .mockResolvedValueOnce({ canViewCase: true })
      .mockResolvedValueOnce({ canViewCase: false });

    const { findSimilarCases } = await import('./case-pattern-detection-service');
    const result = await findSimilarCases({
      context: { caseId: 'case-root', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.caseId).toBe('case-allowed');
    expect(result[0]?.matchReasons).toContain('Same agreement');
    expect(result[0]?.matchedDimensions.grievanceType).toBe(true);
  });

  it('sorts multiple authorized matches by descending score', async () => {
    queueSelectSteps([
      {
        rows: [{
          id: 'case-root', grievanceNumber: 'G-100', title: 'Termination', description: 'Termination dispute',
          type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', workplaceId: 'worksite-1',
          cbaId: 'agreement-1', createdBy: 'user-9', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-01-01T00:00:00Z')
        }],
      },
      {
        rows: [
          {
            id: 'case-weak', grievanceNumber: 'G-201', title: 'Weak match', description: 'Different topic entirely',
            type: 'discipline', status: 'new', grievantId: 'member-9', employerId: 'employer-1', workplaceId: 'worksite-9',
            cbaId: 'agreement-9', createdBy: 'user-2', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-02-01T00:00:00Z')
          },
          {
            id: 'case-strong', grievanceNumber: 'G-202', title: 'Termination follow-up', description: 'Termination dispute with same employer',
            type: 'termination', status: 'new', grievantId: 'member-1', employerId: 'employer-1', workplaceId: 'worksite-1',
            cbaId: 'agreement-1', createdBy: 'user-3', awardSummary: null, organizationId: 'org-1', createdAt: new Date('2026-02-01T00:00:00Z')
          },
        ],
      },
    ]);
    getEffectiveCaseAccess
      .mockResolvedValueOnce({ canViewCase: true })
      .mockResolvedValueOnce({ canViewCase: true });

    const { findSimilarCases } = await import('./case-pattern-detection-service');
    const result = await findSimilarCases({
      context: { caseId: 'case-root', orgId: 'org-1', actorId: 'user-1' },
      actor: { userId: 'user-1', isStewardPlus: false },
      limit: 10,
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.caseId).toBe('case-strong');
    expect(result[0]!.score).toBeGreaterThanOrEqual(result[1]!.score);
  });
});
