/**
 * Organizational Resilience Index
 *
 * Measure organizational continuity resilience across multiple dimensions.
 */

import type { VerifiedEdgeCoverage } from '@/lib/knowledge-transfer/propagation/graph-evidence-service';
import { INTERVIEW_READ_LIMIT } from '@/lib/knowledge-transfer/governance/interview-read-limit';
import type { PropagationMap } from '../propagation/propagation-models';
import { loadGraphEvidence, verifiedEdgeCoverage } from '../propagation/graph-evidence-service';
import { derivedAnalyticsCondition } from '../governance/interview-access';
import { inOrganization } from '../org-scope';
import { ApiError } from '@/lib/api/errors';
import { exitInterviews } from '@/db/schema';

type PublishedInterview = Awaited<ReturnType<typeof loadPublishedInterviews>>[number];

export interface ResilienceIndexDimension {
  name: string;
  score: number; // 0-100
  status: 'critical' | 'at_risk' | 'adequate' | 'strong';
  components: Array<{ name: string; value: number }>;
  recommendations: string[];
}

export interface OrganizationalResilienceIndex {
  organizationId: string;
  generatedAt: string;
  /** Overall resilience score (0-100) */
  overallScore: number;
  /** Overall status */
  status: 'critical' | 'at_risk' | 'adequate' | 'strong';
  /** Performance across dimensions */
  dimensions: ResilienceIndexDimension[];
  /**
   * A single-snapshot risk-concentration signal, not a trend measured across time: 'degrading' when over 40% of
   * dependency nodes are single-source, else 'stable'. There is no prior snapshot to compare against, so this can
   * never read 'improving' - the label names a current risk level, not a direction of change.
   */
  trend: 'stable' | 'degrading';
  /** Maturity level */
  maturityLevel: 'initial' | 'developing' | 'managed' | 'optimized';
  /** Actionable recommendations */
  recommendations: string[];
  /**
   * Every figure above is a heuristic derived from dependency-node and interview counts at this one point in
   * time: trend is a risk-concentration snapshot (see its own doc comment), and maturityLevel/status are score
   * cut-off labels, not a validated assessment of governance maturity or change over time.
   */
  methodologyNote: string;
  /** How many of the dependency nodes behind this index have at least one currently-verified relationship on
   *  file, out of how many nodes exist in total - an aggregate corroboration signal, never a per-dimension gate
   *  (DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE). */
  /** Directed inferred dependencies whose exact direction is currently verified (verifiedEdgeCoverage). Never a
   *  count of nodes that merely appear in some verified record. */
  verifiedEvidenceCoverage: VerifiedEdgeCoverage;
}

async function loadPublishedInterviews(orgId: string) {
  // Read as the runtime role in the organization's own tenant transaction.
  return inOrganization(orgId, (tx) =>
    tx
      .select()
      .from(exitInterviews)
      .where(derivedAnalyticsCondition(orgId))
      .limit(INTERVIEW_READ_LIMIT),
  );
}

export async function calculateResilienceIndex(orgId: string): Promise<OrganizationalResilienceIndex> {
  const evidence = await loadGraphEvidence(orgId);
  const propagationMap = evidence.exploratory;
  const interviews = await loadPublishedInterviews(orgId);

  // Four of the five dimensions are measured over the dependency map. With no nodes they divide by zero, or read a strong score from the
  // absence of risks that were never looked for, so the index is refused rather than calculated.
  if (propagationMap.nodes.length === 0) {
    throw ApiError.conflict('There is no dependency data for this organization, so a resilience index cannot be calculated.');
  }

  // Calculate dimensions
  const redundancyScore = calculateRedundancyScore(propagationMap);
  const documentationScore = calculateDocumentationScore(interviews, propagationMap);
  const governanceScore = calculateGovernanceScore(propagationMap);
  const preparednessScore = calculatePreparednessScore(propagationMap, interviews.length);
  const diversificationScore = calculateDiversificationScore(propagationMap);

  const dimensions: ResilienceIndexDimension[] = [
    {
      name: 'Knowledge Redundancy',
      score: redundancyScore,
      status: statusFromScore(redundancyScore),
      components: [
        { name: 'Single-source knowledge areas', value: propagationMap.nodes.filter((node) => node.isSingleSource).length },
        { name: 'Average coverage', value: propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / Math.max(propagationMap.nodes.length, 1) },
      ],
      recommendations: redundancyScore < 60 ? ['Cross-train on critical areas', 'Document isolated knowledge'] : [],
    },
    {
      name: 'Documentation Maturity',
      score: documentationScore,
      status: statusFromScore(documentationScore),
      components: [
        // DEF-0B7-COGB-RESILIENCE-INDEX-TREND-AND-DOCUMENTATION-QUALITY-ARE-HEURISTIC-LABELS: a separate
        // "Estimated doc quality" figure used to be shown here as a 3-step function of this same interview count -
        // a second number dressed up as an independent quality signal when it carried no information the raw
        // count to its left did not already carry. The raw count is the only honest figure available.
        { name: 'Published interviews', value: interviews.length },
      ],
      recommendations: documentationScore < 60 ? ['Capture more interviews', 'Create runbooks and procedures'] : [],
    },
    {
      name: 'Governance Distribution',
      score: governanceScore,
      status: statusFromScore(governanceScore),
      components: [
        { name: 'Governance/compliance nodes', value: propagationMap.nodes.filter((node) => node.category === 'governance' || node.category === 'compliance').length },
        { name: 'Single-source governance', value: propagationMap.nodes.filter((node) => (node.category === 'governance' || node.category === 'compliance') && node.isSingleSource).length },
      ],
      recommendations: governanceScore < 60 ? ['Formalize governance procedures', 'Cross-train on compliance'] : [],
    },
    {
      name: 'Continuity Preparedness',
      score: preparednessScore,
      status: statusFromScore(preparednessScore),
      components: [
        { name: 'Knowledge capture interviews', value: interviews.length },
        { name: 'Continuity bottlenecks identified', value: propagationMap.bottlenecks.length },
      ],
      recommendations: preparednessScore < 60 ? ['Conduct continuity risk assessment', 'Create business continuity plan'] : [],
    },
    {
      name: 'Operational Diversification',
      score: diversificationScore,
      status: statusFromScore(diversificationScore),
      components: [
        { name: 'Vendor concentration risks', value: propagationMap.nodes.filter((node) => node.category === 'vendor' && node.isSingleSource).length },
        { name: 'System diversification', value: propagationMap.nodes.filter((node) => node.category === 'system').length },
      ],
      recommendations: diversificationScore < 60 ? ['Diversify vendor relationships', 'Consider system redundancy'] : [],
    },
  ];

  // Overall score
  const scores = dimensions.map((d) => d.score);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const overallStatus = statusFromScore(overallScore);

  // Maturity level
  const maturityLevel =
    overallScore >= 80 ? 'optimized' :
    overallScore >= 60 ? 'managed' :
    overallScore >= 40 ? 'developing' :
    'initial';

  // A single-snapshot risk-concentration signal, not a measured trend: there is no prior snapshot to compare
  // against, so this can never read 'improving' (see the field's own doc comment on OrganizationalResilienceIndex).
  const trend = propagationMap.nodes.filter((node) => node.isSingleSource).length > propagationMap.nodes.length * 0.4 ? 'degrading' : 'stable' as const;

  // Overall recommendations
  const recommendations = dimensions
    .filter((d) => d.score < 70)
    .flatMap((d) => d.recommendations)
    .slice(0, 5);

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    overallScore,
    status: overallStatus,
    dimensions,
    trend,
    maturityLevel,
    recommendations,
    methodologyNote:
      'trend is a single-snapshot risk-concentration signal (no prior snapshot exists to compare against, so it ' +
      "can never read 'improving'); maturityLevel and status are score cut-off labels on counts of dependency " +
      'nodes and interviews, not a validated governance or documentation maturity assessment.',
    verifiedEvidenceCoverage: verifiedEdgeCoverage(evidence),
  };
}

function calculateRedundancyScore(propagationMap: PropagationMap): number {
  const totalNodes = propagationMap.nodes.length;
  const singleSourceCount = propagationMap.nodes.filter((node) => node.isSingleSource).length;
  const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;

  // Score based on redundancy
  const singleSourcePenalty = (singleSourceCount / totalNodes) * 40;
  const redundancyBonus = Math.min(avgFrequency * 10, 40);

  return Math.max(50 + redundancyBonus - singleSourcePenalty, 0);
}

function calculateDocumentationScore(interviews: PublishedInterview[], propagationMap: PropagationMap): number {
  let score = Math.min(interviews.length * 10, 60); // Base on interview count

  // Bonus for comprehensive coverage
  const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / propagationMap.nodes.length;
  score += Math.min(avgFrequency * 5, 20);

  // Penalty for undocumented areas
  const undocumentedPenalty = propagationMap.nodes.filter((node) => node.isSingleSource).length / propagationMap.nodes.length * 20;
  score -= undocumentedPenalty;

  return Math.max(Math.min(score, 100), 0);
}

function calculateGovernanceScore(propagationMap: PropagationMap): number {
  const governanceNodes = propagationMap.nodes.filter((node) => node.category === 'governance' || node.category === 'compliance');
  const totalNodes = propagationMap.nodes.length;

  // Score based on governance coverage and redundancy
  let score = 50;
  score += Math.min((governanceNodes.length / totalNodes) * 30, 30); // More governance = better

  const singleSourceGov = governanceNodes.filter((node) => node.isSingleSource).length;
  score -= (singleSourceGov / Math.max(governanceNodes.length, 1)) * 20;

  return Math.max(Math.min(score, 100), 0);
}

function calculatePreparednessScore(propagationMap: PropagationMap, interviewCount: number): number {
  let score = Math.min(interviewCount * 8, 60);

  // Bonus for identified bottlenecks (means org is aware)
  if (propagationMap.bottlenecks.length > 0) score += 15;

  // Penalty for unaddressed critical issues
  const criticalBottlenecks = propagationMap.bottlenecks.filter((bottleneck) => bottleneck.riskLevel === 'critical').length;
  score -= criticalBottlenecks * 10;

  return Math.max(Math.min(score, 100), 0);
}

function calculateDiversificationScore(propagationMap: PropagationMap): number {
  const vendors = propagationMap.nodes.filter((node) => node.category === 'vendor');
  const systems = propagationMap.nodes.filter((node) => node.category === 'system');

  let score = 50;

  // Diversification benefit from multiple systems/vendors
  score += Math.min(systems.length * 5, 25);
  score += Math.min(vendors.length * 5, 25);

  // Penalty for single-source critical items
  const singleSourceCritical = vendors.filter((vendor) => vendor.isSingleSource).length;
  score -= singleSourceCritical * 15;

  return Math.max(Math.min(score, 100), 0);
}

function statusFromScore(score: number): 'critical' | 'at_risk' | 'adequate' | 'strong' {
  if (score < 40) return 'critical';
  if (score < 60) return 'at_risk';
  if (score < 75) return 'adequate';
  return 'strong';
}
