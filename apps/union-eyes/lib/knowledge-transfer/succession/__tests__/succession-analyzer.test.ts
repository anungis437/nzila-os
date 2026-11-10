import { beforeEach, describe, expect, it, vi } from 'vitest';
// The SQL of the eligibility condition is proven against real SQL in app/api/__tests__/interview-derived-analytics.pglite.test.ts.
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'derived-analytics-condition' }))

const { whereMock, generateMock } = vi.hoisted(() => ({
  whereMock: vi.fn(),
  generateMock: vi.fn(),
}));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: (...args: unknown[]) => ({ limit: () => whereMock(...args) }) }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
  // The schema's own role enum, as declared in db/schema (the analyzer reports every role it allows).
  exitInterviewRoleEnum: { enumValues: ['member', 'steward', 'chief_steward', 'officer', 'admin'] },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { internal: (m: string) => Object.assign(new Error(m), { status: 500 }) } }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
  toGatewayDataClass: (c: string) => c,
  buildOrgAiTrace: () => ({}),
  UE_APP_KEY: 'ue',
  UE_SYSTEM_ORG_ID: 'sys',
  UE_PROFILES: { CONTINUITY_RISK: 'cr' },
}));

import { analyzeSuccessionFragility } from '../succession-analyzer';

function interview(role: string, risk: number | null, extra: Record<string, unknown> = {}) {
  return {
    id: `i-${role}-${risk}`,
    roleInUnion: role,
    yearsOfService: 5,
    title: 'Exit',
    topics: ['grievances'],
    expertiseTags: ['x'],
    continuityRiskScore: risk,
    continuityRiskFlags: ['undocumented payroll'],
    ...extra,
  };
}

describe('lib/knowledge-transfer/succession/succession-analyzer', () => {
  beforeEach(() => {
    whereMock.mockReset();
    generateMock.mockReset();
  });

  it('returns empty report and does not call AI when no interviews', async () => {
    whereMock.mockResolvedValue([]);
    const report = await analyzeSuccessionFragility('org-1');
    expect(generateMock).not.toHaveBeenCalled();
    // DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS: readiness is never
    // scored - there is no successor record to score it from.
    expect(report.transitionReadinessScore).toBeNull();
    expect(report.transitionReadinessBasis).toBe('not_assessed_no_successor_records');
    expect(report.departureDocumentationCoverage).toEqual({ rolesWithInterviews: 0, totalRoles: 5 });
    expect(report.executiveSummary).toContain('No published exit interviews');
    // Every schema role is reported, none skipped.
    expect(report.roleSuccessionStatus.map((r) => r.role).sort()).toEqual(['admin', 'chief_steward', 'member', 'officer', 'steward']);
  });

  it('analyzes interviews and reports how documented each role\'s departures are, never a readiness verdict', async () => {
    whereMock.mockResolvedValue([
      interview('steward', 80), // minimal (1 interview, risk>=70)
      interview('officer', 30), // partial (1 interview, risk<70)
      interview('admin', 20), // adequate when 2+
      interview('admin', 40),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: ['gap1'],
        documentationPriorities: ['doc1'],
        continuityRecommendations: ['rec1'],
        governanceMitigations: ['gov1'],
        executiveSummary: 'AI summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    expect(generateMock).toHaveBeenCalledOnce();
    expect(report.criticalOperationalGaps).toEqual(['gap1']);
    expect(report.executiveSummary).toBe('AI summary');
    expect(report.modelGenerated).toBe(true);
    const byRole = Object.fromEntries(report.roleSuccessionStatus.map((r) => [r.role, r.departureDocumentation]));
    expect(byRole).toEqual({
      member: 'no_interview', steward: 'single_interview', chief_steward: 'no_interview', officer: 'single_interview', admin: 'multiple_interviews',
    });
    expect(report.departureDocumentationCoverage).toEqual({ rolesWithInterviews: 3, totalRoles: 5 });
    expect(report.transitionReadinessScore).toBeNull();
    expect(report.roleSuccessionStatus.some((r) => 'successorReadiness' in r)).toBe(false);
  });

  // DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON: a role with fewer than
  // MIN_COHORT_SIZE (5) interviews must not carry that departing person's own years of service and risk score.
  it('withholds years-of-service and risk score for a role below the minimum cohort size', async () => {
    whereMock.mockResolvedValue([interview('steward', 80)]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const steward = report.roleSuccessionStatus.find((r) => r.role === 'steward');
    expect(steward?.interviewCount).toBe(1);
    expect(steward?.smallCellSuppressed).toBe(true);
    expect(steward?.totalYearsOfServiceCaptured).toBeNull();
    expect(steward?.averageContinuityRiskScore).toBeNull();
    // The documentation label comes from the count alone, never from the withheld figures.
    expect(steward?.departureDocumentation).toBe('single_interview');
  });

  it('reports years-of-service and risk score once a role reaches the minimum cohort size', async () => {
    whereMock.mockResolvedValue([
      interview('officer', 20), interview('officer', 30), interview('officer', 40), interview('officer', 50), interview('officer', 60),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const officer = report.roleSuccessionStatus.find((r) => r.role === 'officer');
    expect(officer?.interviewCount).toBe(5);
    expect(officer?.smallCellSuppressed).toBe(false);
    expect(officer?.totalYearsOfServiceCaptured).toBe(25);
    expect(officer?.averageContinuityRiskScore).toBe(40);
  });

  // DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS: interviews with no stored
  // continuity risk score are documented departures with an unrecorded risk - never "adequate" readiness.
  it('does not report readiness from interviews with no recorded risk score', async () => {
    whereMock.mockResolvedValue([
      interview('admin', null), interview('admin', null), interview('admin', null), interview('admin', null), interview('admin', null),
    ]);
    generateMock.mockResolvedValue({
      content: JSON.stringify({
        criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [],
        executiveSummary: 'summary',
      }),
    });
    const report = await analyzeSuccessionFragility('org-1');
    const admin = report.roleSuccessionStatus.find((r) => r.role === 'admin');
    expect(admin?.interviewCount).toBe(5);
    expect(admin?.averageContinuityRiskScore).toBeNull();
    expect(admin?.departureDocumentation).toBe('multiple_interviews');
    expect(report.transitionReadinessScore).toBeNull();
  });

  it('more departures never raise the readiness shown: an organization that lost more people does not read as more ready', async () => {
    const summary = { content: JSON.stringify({ criticalOperationalGaps: [], documentationPriorities: [], continuityRecommendations: [], governanceMitigations: [], executiveSummary: 's' }) };
    generateMock.mockResolvedValue(summary);
    whereMock.mockResolvedValue([interview('steward', 30)]);
    const few = await analyzeSuccessionFragility('org-few');
    whereMock.mockResolvedValue([
      interview('steward', 30), interview('officer', 30), interview('officer', 30), interview('admin', 30), interview('member', 30), interview('chief_steward', 30),
    ]);
    const many = await analyzeSuccessionFragility('org-many');
    expect(few.transitionReadinessScore).toBeNull();
    expect(many.transitionReadinessScore).toBeNull();
    // What grows with departures is labelled as departures, not readiness.
    expect(many.departureDocumentationCoverage.rolesWithInterviews).toBeGreaterThan(few.departureDocumentationCoverage.rolesWithInterviews);
  });

  it('fails instead of returning a canned summary when the model reply is not usable', async () => {
    whereMock.mockResolvedValue([interview('steward', 50)]);
    generateMock.mockResolvedValue({ content: 'not json' });
    await expect(analyzeSuccessionFragility('org-1')).rejects.toMatchObject({ status: 500 });
    generateMock.mockResolvedValue({ content: JSON.stringify({ executiveSummary: 'incomplete' }) });
    await expect(analyzeSuccessionFragility('org-1')).rejects.toMatchObject({ status: 500 });
  });

  it('marks the report as model-generated only when a model produced it', async () => {
    whereMock.mockResolvedValue([]);
    expect((await analyzeSuccessionFragility('org-1')).modelGenerated).toBe(false);
  });
});
