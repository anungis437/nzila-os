/**
 * Decision Intelligence Engine
 *
 * Generates prioritized, fully transparent continuity planning recommendations.
 * Every recommendation exposes evidence lineage, reasoning chain, and assumptions.
 *
 * This supports organizational continuity decision-making — not workforce management.
 * Recommendations address documentation, governance, redundancy, and operational resilience.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import { calculateResilienceIndex } from '../resilience-index/resilience-calculator';
import { forecastContinuityTrends } from '../forecasting/continuity-forecaster';
import {
  type ContinuityRecommendation,
  type DecisionBrief,
  type EvidenceItem,
  type ReasoningStep,
} from './decision-models';

let _recCounter = 0;
function recId(): string {
  return `rec_${Date.now()}_${++_recCounter}`;
}

function buildSingleSourceRecommendation(
  singleSourceCount: number,
  totalNodes: number,
  criticalSingleSource: any[],
): ContinuityRecommendation | null {
  if (singleSourceCount === 0) return null;
  const pct = Math.round((singleSourceCount / Math.max(totalNodes, 1)) * 100);
  const topNodes = criticalSingleSource.slice(0, 3).map((n: any) => n.label);
  return {
    id: recId(),
    category: 'redundancy_investment',
    urgency: singleSourceCount >= 5 ? 'immediate' : 'near_term',
    impact: singleSourceCount >= 8 ? 'transformative' : singleSourceCount >= 4 ? 'significant' : 'moderate',
    headline: `Address ${singleSourceCount} single-source knowledge dependencies`,
    rationale: `${pct}% of tracked operational knowledge exists in only one source. Any disruption to these areas would immediately impair organizational continuity with no fallback.`,
    evidence: [
      {
        observation: `${singleSourceCount} of ${totalNodes} knowledge nodes have single-source coverage`,
        dataPoint: `${pct}% single-source concentration`,
        confidence: 'high',
      },
      {
        observation: `Critical areas include: ${topNodes.join(', ')}`,
        dataPoint: `Top ${topNodes.length} single-source critical nodes identified`,
        confidence: 'high',
      },
    ],
    reasoningChain: [
      {
        step: 1,
        evaluation: 'Assessed knowledge redundancy across all tracked operational domains',
        conclusion: `${singleSourceCount} domains have no redundancy`,
        assumption: 'Published exit interviews accurately represent organizational knowledge distribution',
      },
      {
        step: 2,
        evaluation: 'Evaluated continuity risk of single-source nodes',
        conclusion: 'Any disruption to single-source knowledge would be immediately operational',
        assumption: 'Knowledge cannot be quickly reconstructed without the original source',
      },
      {
        step: 3,
        evaluation: 'Prioritized by operational sensitivity',
        conclusion: `${criticalSingleSource.filter((n: any) => n.continuitySensitivity === 'critical').length} critical-sensitivity nodes identified`,
        assumption: 'Continuity sensitivity ratings are based on role coverage and interview frequency',
      },
    ],
    keyAssumptions: [
      'Knowledge concentration data is derived from published exit interviews',
      'Single-source nodes have no undocumented backup coverage',
    ],
    governanceImplications: [
      'Governance knowledge with single-source coverage creates regulatory continuity risk',
      'Compliance processes may depend on single institutional knowledge holders',
    ],
    continuityLogic: 'Reducing single-source dependencies directly lowers the probability of operational collapse when knowledge holders are unavailable.',
    tradeoffs: [
      'Cross-training requires time investment from existing knowledge holders',
      'Documentation quality depends on knowledge holder engagement',
    ],
    estimatedResilienceGain: Math.min(25, singleSourceCount * 2),
  };
}

function buildGovernanceRecommendation(
  govSingleSource: number,
  totalGovNodes: number,
): ContinuityRecommendation | null {
  if (govSingleSource === 0) return null;
  return {
    id: recId(),
    category: 'governance_stabilization',
    urgency: govSingleSource >= 3 ? 'immediate' : 'near_term',
    impact: 'significant',
    headline: `Stabilize governance continuity — ${govSingleSource} fragile governance processes`,
    rationale: `${govSingleSource} governance/compliance processes have single-source coverage. Governance continuity failures can create regulatory exposure and operational paralysis in critical decision-making.`,
    evidence: [
      {
        observation: `${govSingleSource} of ${totalGovNodes} governance nodes are single-source`,
        dataPoint: `${Math.round((govSingleSource / Math.max(totalGovNodes, 1)) * 100)}% governance concentration`,
        confidence: 'high',
      },
    ],
    reasoningChain: [
      {
        step: 1,
        evaluation: 'Identified governance and compliance nodes in the dependency graph',
        conclusion: `${totalGovNodes} governance/compliance processes tracked`,
        assumption: 'Governance topics are identified via keyword classification in interview data',
      },
      {
        step: 2,
        evaluation: 'Assessed redundancy for each governance process',
        conclusion: `${govSingleSource} governance processes lack backup coverage`,
        assumption: 'Single-source means no other interview participants referenced this process',
      },
    ],
    keyAssumptions: [
      'Governance classification is based on topic keyword analysis',
      'Regulatory and compliance obligations require institutional knowledge continuity',
    ],
    governanceImplications: [
      'Regulatory compliance may be at risk if key governance knowledge is lost',
      'Governance decentralization is both a resilience and democratic organizational improvement',
    ],
    continuityLogic: 'Governance failures cascade into operational paralysis — approval processes, compliance reporting, and institutional decision-making all depend on governance knowledge continuity.',
    tradeoffs: [
      'Governance decentralization requires careful procedure formalization',
      'Compliance knowledge transfer must meet regulatory standards',
    ],
    estimatedResilienceGain: govSingleSource >= 3 ? 20 : 10,
  };
}

function buildDocumentationRecommendation(
  undocumentedChainCount: number,
  totalNodes: number,
): ContinuityRecommendation | null {
  if (undocumentedChainCount === 0) return null;
  return {
    id: recId(),
    category: 'documentation_investment',
    urgency: undocumentedChainCount >= 4 ? 'immediate' : 'near_term',
    impact: undocumentedChainCount >= 6 ? 'significant' : 'moderate',
    headline: `Launch documentation campaign — ${undocumentedChainCount} undocumented operational chains`,
    rationale: `${undocumentedChainCount} operational chains exist only as tacit knowledge with no documented backup. Loss of any link in these chains would require complete relearning with no institutional reference.`,
    evidence: [
      {
        observation: `${undocumentedChainCount} single-source chains with no documentation signals`,
        dataPoint: `${Math.round((undocumentedChainCount / Math.max(totalNodes, 1)) * 100)}% of nodes are undocumented chains`,
        confidence: 'medium',
      },
    ],
    reasoningChain: [
      {
        step: 1,
        evaluation: 'Identified single-source nodes with dependent downstream chains',
        conclusion: `${undocumentedChainCount} dependency chains lack redundancy`,
        assumption: 'Chains without multiple-contributor nodes are effectively undocumented',
      },
      {
        step: 2,
        evaluation: 'Assessed the operational impact of undocumented chain failure',
        conclusion: 'Undocumented chains represent the highest organizational memory risk',
        assumption: 'Knowledge that exists only in individuals cannot survive role transitions',
      },
    ],
    keyAssumptions: [
      'Documentation status is inferred from coverage count — not direct documentation audits',
      'Single-contributor topics may have informal documentation not captured in the system',
    ],
    governanceImplications: [
      'Undocumented procedures may not meet governance formalization standards',
      'Audit trails may be incomplete if processes are undocumented',
    ],
    continuityLogic: 'Documentation creates institutional memory that survives role transitions, enabling operational continuity regardless of individual availability.',
    tradeoffs: [
      'Documentation requires structured time from existing knowledge holders',
      'Documentation quality is only as good as the review process applied',
    ],
    estimatedResilienceGain: Math.min(20, undocumentedChainCount * 2),
  };
}

function buildVendorRecommendation(
  vendorSingleSource: number,
): ContinuityRecommendation | null {
  if (vendorSingleSource === 0) return null;
  return {
    id: recId(),
    category: 'vendor_resilience',
    urgency: vendorSingleSource >= 3 ? 'near_term' : 'strategic',
    impact: vendorSingleSource >= 4 ? 'significant' : 'moderate',
    headline: `Reduce vendor dependency concentration — ${vendorSingleSource} single-source vendor dependencies`,
    rationale: `${vendorSingleSource} vendor relationships have single-source dependency exposure. Vendor disruptions in these areas have no fallback operational pathway.`,
    evidence: [
      {
        observation: `${vendorSingleSource} vendor nodes identified as single-source dependencies`,
        dataPoint: `${vendorSingleSource} vendors with no identified alternatives`,
        confidence: 'medium',
      },
    ],
    reasoningChain: [
      {
        step: 1,
        evaluation: 'Identified vendor dependency nodes in the organizational graph',
        conclusion: `${vendorSingleSource} vendor dependencies have no fallback`,
        assumption: 'Vendor nodes identified via keyword analysis in interview data',
      },
    ],
    keyAssumptions: [
      'Vendor dependencies are identified from interview topic analysis',
      'Alternative vendors may exist but not be documented in interview data',
    ],
    governanceImplications: [
      'Single-vendor dependencies may conflict with continuity governance requirements',
      'Procurement governance should address vendor diversity requirements',
    ],
    continuityLogic: 'Vendor diversification prevents operational dependency on any single external supplier — reducing external continuity fragility.',
    tradeoffs: [
      'Multi-vendor strategies may increase procurement complexity and cost',
      'Vendor transition carries short-term continuity disruption risk',
    ],
    estimatedResilienceGain: Math.min(15, vendorSingleSource * 3),
  };
}

/**
 * Generate a comprehensive organizational continuity decision brief.
 * All recommendations are fully explainable with evidence and reasoning chains.
 */
export async function generateDecisionBrief(orgId: string): Promise<DecisionBrief> {
  const [propagationMap, resilienceIndex, forecast] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    calculateResilienceIndex(orgId),
    forecastContinuityTrends(orgId),
  ]);

  const nodes = propagationMap.nodes as any[];
  const singleSourceNodes = nodes.filter((n) => n.isSingleSource);
  const govNodes = nodes.filter((n) => n.category === 'governance' || n.category === 'compliance');
  const govSingleSource = govNodes.filter((n) => n.isSingleSource);
  const vendorNodes = nodes.filter((n) => n.category === 'vendor' || n.nodeType === 'vendor');
  const vendorSingleSource = vendorNodes.filter((n) => n.isSingleSource);
  const criticalSingleSource = singleSourceNodes.filter((n) => n.continuitySensitivity === 'critical');
  const undocumentedChains = singleSourceNodes.filter((n) => {
    const downstream = propagationMap.downstreamImpacts.find((d: any) => d.nodeId === n.id);
    return downstream && downstream.directDependents?.length > 0;
  });

  // Build recommendations
  const recommendations: ContinuityRecommendation[] = [];
  const singleSourceRec = buildSingleSourceRecommendation(singleSourceNodes.length, nodes.length, criticalSingleSource);
  if (singleSourceRec) recommendations.push(singleSourceRec);

  const govRec = buildGovernanceRecommendation(govSingleSource.length, govNodes.length);
  if (govRec) recommendations.push(govRec);

  const docRec = buildDocumentationRecommendation(undocumentedChains.length, nodes.length);
  if (docRec) recommendations.push(docRec);

  const vendorRec = buildVendorRecommendation(vendorSingleSource.length);
  if (vendorRec) recommendations.push(vendorRec);

  // Sort: immediate > near_term > strategic > aspirational, then by impact
  const urgencyOrder: Record<string, number> = { immediate: 0, near_term: 1, strategic: 2, aspirational: 3 };
  const impactOrder: Record<string, number> = { transformative: 0, significant: 1, moderate: 2, marginal: 3 };
  recommendations.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uDiff !== 0) return uDiff;
    return impactOrder[a.impact] - impactOrder[b.impact];
  });

  // Build current state assessment
  const score = resilienceIndex.overallScore;
  const status = resilienceIndex.status;
  const currentStateAssessment =
    status === 'critical' ? `Organization faces critical continuity fragility (score: ${score}/100). Immediate intervention is required across multiple domains.`
    : status === 'at_risk' ? `Organization continuity is at risk (score: ${score}/100). Multiple fragility areas require near-term attention.`
    : status === 'adequate' ? `Organization has adequate continuity resilience (score: ${score}/100), with specific areas requiring targeted improvement.`
    : `Organization demonstrates strong continuity resilience (score: ${score}/100). Focus on sustaining and extending current strengths.`;

  // Identify strengths
  const continuityStrengths: string[] = [];
  const strongDimensions = resilienceIndex.dimensions.filter((d) => d.score >= 70);
  for (const dim of strongDimensions) {
    continuityStrengths.push(`${dim.name}: strong (${dim.score}/100)`);
  }
  if (nodes.filter((n) => !n.isSingleSource && n.frequency >= 3).length > 0) {
    const wellCovered = nodes.filter((n) => !n.isSingleSource && n.frequency >= 3).length;
    continuityStrengths.push(`${wellCovered} operational areas have multi-person knowledge coverage`);
  }

  // Critical gaps
  const criticalGaps: string[] = [];
  if (criticalSingleSource.length > 0) {
    criticalGaps.push(`${criticalSingleSource.length} critical-sensitivity areas have no knowledge backup`);
  }
  if (govSingleSource.length > 0) {
    criticalGaps.push(`${govSingleSource.length} governance/compliance processes are single-source`);
  }
  const criticalBottlenecks = propagationMap.bottlenecks?.filter((b: any) => b.riskLevel === 'critical') ?? [];
  if (criticalBottlenecks.length > 0) {
    criticalGaps.push(`${criticalBottlenecks.length} critical operational bottlenecks identified`);
  }
  if (forecast.trendDirection === 'degrading') {
    criticalGaps.push('Continuity health is trending downward without intervention');
  }

  // Governance exposure summary
  const govExposurePct = govNodes.length > 0
    ? Math.round((govSingleSource.length / govNodes.length) * 100)
    : 0;
  const governanceExposureSummary =
    govExposurePct >= 60 ? `Governance continuity is highly concentrated — ${govExposurePct}% of governance processes are single-source. Regulatory continuity is at significant risk.`
    : govExposurePct >= 30 ? `Moderate governance concentration (${govExposurePct}% single-source). Governance continuity requires active monitoring and decentralization planning.`
    : `Governance continuity is reasonably distributed (${govExposurePct}% single-source). Continue current governance knowledge-sharing practices.`;

  // Executive summary
  const topRec = recommendations[0] ?? null;
  const executiveSummary = [
    currentStateAssessment,
    recommendations.length > 0
      ? `${recommendations.length} continuity planning action${recommendations.length > 1 ? 's' : ''} have been identified.`
      : 'No critical continuity gaps detected at this time.',
    topRec ? `Highest priority: ${topRec.headline}.` : '',
    `Forecast: continuity health is ${forecast.trendDirection} over the next 12 months.`,
  ].filter(Boolean).join(' ');

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    currentStateAssessment,
    continuityScore: score,
    recommendations,
    topPriority: topRec,
    continuityStrengths,
    criticalGaps,
    governanceExposureSummary,
    executiveSummary,
  };
}
