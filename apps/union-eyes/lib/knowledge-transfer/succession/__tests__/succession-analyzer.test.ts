import { beforeEach, describe, expect, it, vi } from 'vitest';

const { whereMock, generateMock } = vi.hoisted(() => ({
  whereMock: vi.fn(),
  generateMock: vi.fn(),
}));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: whereMock }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: new Proxy({}, { get: (_t, p) => String(p) }),
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));
vi.mock('@/lib/ai/ai-client', () => ({
  getAiClient: () => ({ generate: generateMock }),
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
    expect(report.transitionReadinessScore).toBeGreaterThanOrEqual(0);
    expect(report.executiveSummary).toContain('No published exit interviews');
    expect(report.roleSuccessionStatus.length).toBe(5);
  });

  it('analyzes interviews and parses AI JSON with varied readiness', async () => {
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
    const steward = report.roleSuccessionStatus.find((r) => r.role === 'steward');
    expect(steward?.successorReadiness).toBe('minimal');
    const admin = report.roleSuccessionStatus.find((r) => r.role === 'admin');
    expect(admin?.successorReadiness).toBe('adequate');
    const officer = report.roleSuccessionStatus.find((r) => r.role === 'officer');
    expect(officer?.successorReadiness).toBe('partial');
    const member = report.roleSuccessionStatus.find((r) => r.role === 'member');
    expect(member?.successorReadiness).toBe('none');
  });

  it('falls back to default summary on invalid AI JSON', async () => {
    whereMock.mockResolvedValue([interview('steward', 50)]);
    generateMock.mockResolvedValue({ content: 'not json' });
    const report = await analyzeSuccessionFragility('org-1');
    expect(report.executiveSummary).toContain('Transition readiness score');
    expect(report.criticalOperationalGaps).toEqual([]);
  });
});
