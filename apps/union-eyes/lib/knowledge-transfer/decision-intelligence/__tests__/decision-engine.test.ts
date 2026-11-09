/**
 * Decision Intelligence Engine — Unit Tests
 *
 * Drives generateDecisionBrief with mocked propagation map, resilience index,
 * and forecast to exercise all four recommendation builders, sorting, current
 * state/strength/gap derivation, governance exposure tiers, and summaries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ buildMap: vi.fn(), resilience: vi.fn(), forecast: vi.fn(), listVerifiedDependencies: vi.fn(), listActiveNodeAliases: vi.fn(async () => []), loadEvidenceDocumentIntegrity: vi.fn() }));

vi.mock('@/lib/knowledge-transfer/propagation/dependency-propagator', () => ({
  buildDependencyPropagationMap: mocks.buildMap,
}));
vi.mock('@/lib/knowledge-transfer/propagation/verified-dependency-store', () => ({
  listVerifiedDependencies: mocks.listVerifiedDependencies,
}));
vi.mock('@/lib/knowledge-transfer/propagation/node-alias-store', () => ({
  listActiveNodeAliases: mocks.listActiveNodeAliases,
}));
vi.mock('@/lib/knowledge-transfer/propagation/evidence-document-reference', () => ({
  loadEvidenceDocumentIntegrity: mocks.loadEvidenceDocumentIntegrity,
}));
vi.mock('@/lib/knowledge-transfer/resilience-index/resilience-calculator', () => ({
  calculateResilienceIndex: mocks.resilience,
}));
vi.mock('@/lib/knowledge-transfer/forecasting/continuity-forecaster', () => ({
  forecastContinuityTrends: mocks.forecast,
}));

import { generateDecisionBrief, assessConfirmedDependencyRisk } from '../decision-engine';
import { currentVerifiedRecord } from '@/lib/knowledge-transfer/propagation/__tests__/verified-record-fixture';

function node(id: string, category: string, isSingleSource: boolean, sensitivity = 'low', frequency = 5) {
  return {
    id, label: id, nodeType: category, category, frequency: isSingleSource ? 1 : frequency,
    associatedRoles: ['R'], isSingleSource, continuitySensitivity: sensitivity, sensitivityReason: '',
  };
}

function propMap(nodes: unknown[], downstreamImpacts: unknown[] = [], bottlenecks: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(),
    nodes, edges: [], downstreamImpacts, upstreamDependencies: [], couplingAnalysis: [],
    bottlenecks, resilience: { recommendations: [], priorityOrder: [], estimatedEffort: {} },
  };
}

function resilienceIndex(overallScore: number, status: string, dimensions: unknown[] = []) {
  return {
    organizationId: 'org', generatedAt: new Date().toISOString(), overallScore, status,
    dimensions, trend: 'stable', maturityLevel: 'developing', recommendations: [],
  };
}

describe('generateDecisionBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.forecast.mockResolvedValue({ trendDirection: 'stable' });
    mocks.resilience.mockResolvedValue(resilienceIndex(80, 'strong', [{ name: 'Knowledge Redundancy', score: 85 }]));
    mocks.buildMap.mockResolvedValue(propMap([node('x', 'general', false)]));
    mocks.listVerifiedDependencies.mockResolvedValue([]);
    mocks.loadEvidenceDocumentIntegrity.mockResolvedValue(new Map());
  });

  it('produces no recommendations for a healthy org', async () => {
    const brief = await generateDecisionBrief('org');
    expect(brief.recommendations).toHaveLength(0);
    expect(brief.topPriority).toBeNull();
    expect(brief.currentStateAssessment).toContain('strong');
    expect(brief.executiveSummary).toContain('No critical continuity gaps');
    expect(brief.continuityStrengths.some((s) => s.includes('Knowledge Redundancy'))).toBe(true);
  });

  it('generates and sorts all four recommendation types for a fragile org', async () => {
    mocks.forecast.mockResolvedValue({ trendDirection: 'degrading' });
    mocks.resilience.mockResolvedValue(
      resilienceIndex(25, 'critical', [
        { name: 'Knowledge Redundancy', score: 20 },
        { name: 'Documentation Maturity', score: 75 },
      ]),
    );
    const nodes = [
      node('gov1', 'governance', true, 'critical'),
      node('gov2', 'governance', true, 'critical'),
      node('gov3', 'compliance', true, 'critical'),
      node('vend1', 'vendor', true, 'high'),
      node('vend2', 'vendor', true, 'high'),
      node('vend3', 'vendor', true, 'high'),
      node('sys1', 'system', true, 'high'),
      node('sys2', 'system', true, 'high'),
      node('exp1', 'expertise', true, 'critical'),
    ];
    const downstream = [
      { nodeId: 'gov1', directDependents: ['gov2'], allAffectedNodes: ['gov2'], propagationPaths: [], totalExposureScore: 80, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'critical', actions: [] } },
      { nodeId: 'sys1', directDependents: ['sys2'], allAffectedNodes: ['sys2'], propagationPaths: [], totalExposureScore: 60, governanceExposure: [], vendorDependencyExposure: [], mitigation: { priority: 'high', actions: [] } },
    ];
    const bottlenecks = [{ nodeId: 'gov1', reason: 'single_source', riskLevel: 'critical', affectedRoles: ['R'] }];
    mocks.buildMap.mockResolvedValue(propMap(nodes, downstream, bottlenecks));

    const brief = await generateDecisionBrief('org');

    // DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: evidence coverage must come from how many nodes
    // underlie the claim, not a fixed literal chosen by recommendation category - and it is coverage (volume), not
    // a claim that the recommendation is correct.
    const redundancyRec = brief.recommendations.find((r) => r.category === 'redundancy_investment')!;
    expect(redundancyRec.evidence[0].evidenceCoverage).toBe('high'); // 9 single-source nodes >= MIN_COHORT_SIZE
    const govRec = brief.recommendations.find((r) => r.category === 'governance_stabilization')!;
    expect(govRec.evidence[0].evidenceCoverage).toBe('medium'); // 3 single-source governance nodes, below MIN_COHORT_SIZE

    const categories = brief.recommendations.map((r) => r.category);
    expect(categories).toContain('redundancy_investment');
    expect(categories).toContain('governance_stabilization');
    expect(categories).toContain('documentation_investment');
    expect(categories).toContain('vendor_resilience');

    // sorted: immediate urgency first
    expect(brief.recommendations[0].urgency).toBe('immediate');
    expect(brief.topPriority).not.toBeNull();
    expect(brief.topPriority!.id).toBe(brief.recommendations[0].id);

    // critical state assessment
    expect(brief.currentStateAssessment).toContain('critical continuity fragility');
    // critical gaps populated incl forecast degrading + bottlenecks + gov single-source
    expect(brief.criticalGaps.some((g) => g.includes('critical-sensitivity'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('governance/compliance'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('bottleneck'))).toBe(true);
    // gaps derived from the exploratory propagation map must say so, not read as confirmed findings
    expect(brief.criticalGaps.some((g) => g.includes('Exploratory pattern analysis'))).toBe(true);
    expect(brief.criticalGaps.some((g) => g.includes('trending downward'))).toBe(true);
    // governance exposure highly concentrated (100% single source)
    expect(brief.governanceExposureSummary).toContain('highly concentrated');
    expect(brief.executiveSummary).toContain('Highest priority');
    expect(brief.executiveSummary).toContain('degrading');

    // DEF-0B7-COGB: with no verified dependency evidence recorded, confirmed risk is explicitly unavailable, never
    // silently filled from the exploratory propagation map used for criticalGaps above.
    expect(brief.confirmedDependencyRiskStatus).toBe('no_verified_dependency_evidence_recorded');
    expect(brief.confirmedDependencyRisks).toEqual([]);
  });

  const PAYROLL = node('payroll_system', 'system', true, 'critical');
  const STEWARD = node('finance_steward', 'expertise', false);

  it('reports confirmed dependency risk only from CURRENT verified evidence, in its verified direction, with its evidence tier', async () => {
    mocks.buildMap.mockResolvedValue(propMap([PAYROLL, STEWARD]));
    mocks.listVerifiedDependencies.mockResolvedValue([
      currentVerifiedRecord(STEWARD, PAYROLL, {
        id: 'vd1', processOrSystem: 'Payroll processing', responsibleAuthority: 'Finance Director', evidenceReference: 'SOP-114 v3',
      }),
    ]);

    const brief = await generateDecisionBrief('org');

    expect(brief.confirmedDependencyRiskStatus).toBe('verified_dependency_evidence_available');
    expect(brief.confirmedDependencyRisks).toHaveLength(1);
    expect(brief.confirmedDependencyRisks[0]).toMatchObject({
      dependentNodeId: 'finance_steward',
      dependentLabel: 'finance_steward',
      dependsOnNodeId: 'payroll_system',
      dependsOnLabel: 'payroll_system',
      processOrSystem: 'Payroll processing',
      responsibleAuthority: 'Finance Director',
      evidenceReference: 'SOP-114 v3',
      evidenceTier: 'human_attested_external',
      verifiedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('carries the system_resolved_document tier for a document record bound to its unchanged content', async () => {
    mocks.buildMap.mockResolvedValue(propMap([PAYROLL, STEWARD]));
    mocks.loadEvidenceDocumentIntegrity.mockResolvedValue(new Map([['doc-1', { active: true, integrity: 'sha256:abc' }]]));
    mocks.listVerifiedDependencies.mockResolvedValue([
      currentVerifiedRecord(STEWARD, PAYROLL, {
        evidenceReferenceType: 'document', evidenceDocumentId: 'doc-1', evidenceDocumentIntegrity: 'sha256:abc',
        externalAttestation: null, externalAttestedBy: null, externalAttestedAt: null,
      }),
    ]);
    const result = await assessConfirmedDependencyRisk('org');
    expect(result.status).toBe('verified_dependency_evidence_available');
    expect(result.risks.map((r) => r.evidenceTier)).toEqual(['system_resolved_document']);
  });

  it('never reports a stale verified record as confirmed, and says re-verification is required', async () => {
    mocks.buildMap.mockResolvedValue(propMap([PAYROLL, STEWARD]));
    mocks.loadEvidenceDocumentIntegrity.mockResolvedValue(new Map([['doc-1', { active: true, integrity: 'version:2:new' }]]));
    mocks.listVerifiedDependencies.mockResolvedValue([
      // Classification drifted since verification (payroll_system was 'vendor' then).
      currentVerifiedRecord(STEWARD, { ...PAYROLL, category: 'vendor' }, { id: 'drifted' }),
      // External citation attested by its own submitter.
      currentVerifiedRecord(PAYROLL, STEWARD, { id: 'self-attested', externalAttestedBy: 'u1' }),
      // Document whose content changed after verification.
      currentVerifiedRecord(STEWARD, PAYROLL, {
        id: 'doc-changed', evidenceReferenceType: 'document', evidenceDocumentId: 'doc-1', evidenceDocumentIntegrity: 'version:1:old',
        externalAttestation: null, externalAttestedBy: null, externalAttestedAt: null,
      }),
    ]);

    const brief = await generateDecisionBrief('org');
    expect(brief.confirmedDependencyRiskStatus).toBe('verified_dependency_evidence_requires_reverification');
    expect(brief.confirmedDependencyRisks).toEqual([]);
  });

  it('reports only the current records when current and stale verified records coexist', async () => {
    const ledger = node('ledger', 'system', false);
    mocks.buildMap.mockResolvedValue(propMap([PAYROLL, STEWARD, ledger]));
    mocks.listVerifiedDependencies.mockResolvedValue([
      currentVerifiedRecord(STEWARD, PAYROLL, { id: 'current' }),
      // References a node that no longer exists in the graph.
      currentVerifiedRecord(STEWARD, node('retired_tool', 'system', false), { id: 'gone' }),
    ]);
    const result = await assessConfirmedDependencyRisk('org');
    expect(result.status).toBe('verified_dependency_evidence_available');
    expect(result.risks.map((r) => [r.dependentNodeId, r.dependsOnNodeId])).toEqual([['finance_steward', 'payroll_system']]);
  });

  it('covers at_risk and adequate state + moderate/low governance tiers', async () => {
    // at_risk path
    mocks.resilience.mockResolvedValue(resilienceIndex(50, 'at_risk', []));
    mocks.buildMap.mockResolvedValue(
      propMap([
        node('gov1', 'governance', true, 'high'),
        node('gov2', 'governance', false, 'low'),
        node('gov3', 'governance', false, 'low'),
        node('a', 'general', false, 'low', 4),
      ]),
    );
    const atRisk = await generateDecisionBrief('org');
    expect(atRisk.currentStateAssessment).toContain('at risk');
    // 1 of 3 gov single source = 33% -> moderate concentration
    expect(atRisk.governanceExposureSummary).toContain('Moderate governance concentration');

    // adequate path + low governance concentration
    mocks.resilience.mockResolvedValue(resilienceIndex(70, 'adequate', []));
    mocks.buildMap.mockResolvedValue(
      propMap([
        node('gov1', 'governance', false, 'low'),
        node('gov2', 'governance', false, 'low'),
        node('gov3', 'governance', false, 'low'),
      ]),
    );
    const adequate = await generateDecisionBrief('org');
    expect(adequate.currentStateAssessment).toContain('adequate');
    expect(adequate.governanceExposureSummary).toContain('reasonably distributed');
  });
});
