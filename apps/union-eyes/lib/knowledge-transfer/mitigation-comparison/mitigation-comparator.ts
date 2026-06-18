/**
 * Mitigation Comparison Engine
 *
 * Compares the effectiveness of different continuity interventions.
 * Outputs resilience improvement deltas, governance stabilization gains,
 * and dependency concentration reductions.
 *
 * This is continuity decision intelligence — helping organizations
 * choose the right investments to strengthen organizational resilience.
 *
 * FRAMING: All comparisons are organizational interventions.
 * This system models documentation, governance, and operational processes.
 * It does NOT optimize workforce, rank workers, or model individual value.
 */

import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import { calculateResilienceIndex } from '../resilience-index/resilience-calculator';
import {
  type MitigationScenario,
  type MitigationResult,
  type MitigationComparison,
  type MitigationImpactDelta,
  type ResilienceImprovementProjection,
  getMitigationEffectivenessMultiplier,
} from './mitigation-models';

function generateScenarioId(): string {
  return `mit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Project 12-week improvement curve for a mitigation scenario.
 * Mitigation effects ramp up over time (sigmoid-like, capped by durationWeeks).
 */
function buildProjectionCurve(
  baselineScore: number,
  resilienceGain: number,
  durationWeeks: number,
): ResilienceImprovementProjection[] {
  const weeks = 12;
  return Array.from({ length: weeks }, (_, i) => {
    const weekNum = i + 1;
    // Sigmoid ramp-up — gains accumulate, peak at durationWeeks
    const progress = Math.min(weekNum / durationWeeks, 1.0);
    const effectiveFactor = 1 / (1 + Math.exp(-8 * (progress - 0.5)));
    const gain = resilienceGain * effectiveFactor;
    const mitigatedHealthScore = Math.min(100, baselineScore + gain);
    const noMitigationDecay = Math.max(0, baselineScore - weekNum * 0.5);
    return {
      week: weekNum,
      mitigatedHealthScore: Math.round(mitigatedHealthScore * 10) / 10,
      baselineHealthScore: Math.round(noMitigationDecay * 10) / 10,
      delta: Math.round((mitigatedHealthScore - noMitigationDecay) * 10) / 10,
    };
  });
}

/**
 * Generate an action plan for a mitigation type.
 */
function buildActionPlan(scenario: MitigationScenario): string[] {
  const plans: Record<string, string[]> = {
    documentation_campaign: [
      'Identify all undocumented workflows and procedures',
      'Assign documentation owners for each critical process',
      'Create standardized documentation templates',
      'Establish documentation review checkpoints',
      'Build organizational knowledge repository',
    ],
    cross_training: [
      'Map single-source expertise areas requiring backup coverage',
      'Design cross-training curriculum for critical operations',
      'Pair senior knowledge holders with emerging practitioners',
      'Schedule structured knowledge-transfer sessions',
      'Create cross-training completion tracking',
    ],
    redundancy_improvement: [
      'Identify single-source operational dependencies',
      'Design multi-person knowledge coverage plans',
      'Implement role rotation for critical operational functions',
      'Document backup procedures for key processes',
      'Validate redundancy through periodic testing',
    ],
    governance_decentralization: [
      'Map current governance concentration by area',
      'Identify governance functions that can be distributed',
      'Train secondary governance leads',
      'Formalize governance delegation procedures',
      'Establish governance continuity protocols',
    ],
    vendor_diversification: [
      'Audit current vendor dependency concentration',
      'Identify high-risk single-vendor dependencies',
      'Research and qualify alternative vendor options',
      'Develop vendor transition contingency plans',
      'Negotiate multi-vendor agreements where possible',
    ],
    operational_restructuring: [
      'Review operational procedures for fragility points',
      'Redesign workflows to reduce single-point dependencies',
      'Document restructured operational procedures',
      'Train operational staff on new procedures',
      'Monitor restructuring effectiveness',
    ],
    continuity_mentorship: [
      'Identify organizational knowledge holders',
      'Pair knowledge holders with continuity successors',
      'Establish structured mentorship programs',
      'Create knowledge transfer milestones',
      'Document transferred organizational knowledge',
    ],
    institutional_transfer_program: [
      'Create comprehensive organizational knowledge inventory',
      'Design formal knowledge transfer program',
      'Schedule intensive handover sessions',
      'Produce organizational memory documentation',
      'Validate transfer completeness through assessment',
    ],
  };
  return plans[scenario.mitigationType] ?? ['Define intervention scope', 'Execute mitigation plan'];
}

/**
 * Evaluate a single mitigation scenario against the current propagation state.
 */
async function evaluateMitigationScenario(
  orgId: string,
  scenario: MitigationScenario,
  propagationMap: Awaited<ReturnType<typeof buildDependencyPropagationMap>>,
  baselineScore: number,
): Promise<MitigationResult> {
  const scenarioId = generateScenarioId();
  const label = scenario.label ?? scenario.mitigationType.replace(/_/g, ' ');

  // Find affected nodes
  const affectedNodes = scenario.targetNodeIds.length > 0
    ? propagationMap.nodes.filter((node) => scenario.targetNodeIds.includes(node.id))
    : propagationMap.nodes.filter((node) => node.isSingleSource || node.continuitySensitivity === 'critical');

  // Compute domain-level impact deltas
  const domainDeltas: MitigationImpactDelta[] = affectedNodes.map((node) => {
    const effectiveness = getMitigationEffectivenessMultiplier(
      scenario.mitigationType,
      node.nodeType,
    );
    const baselineExposure =
      node.continuitySensitivity === 'critical' ? 90 :
      node.continuitySensitivity === 'high' ? 70 :
      node.continuitySensitivity === 'medium' ? 45 :
      20;
    const investmentBonus = scenario.investmentLevel === 'high' ? 1.2
      : scenario.investmentLevel === 'low' ? 0.7 : 1.0;
    const reduction = Math.round(baselineExposure * effectiveness * investmentBonus);
    const mitigatedExposure = Math.max(5, baselineExposure - reduction);
    return {
      domain: node.label,
      baselineExposure,
      mitigatedExposure,
      exposureReduction: baselineExposure - mitigatedExposure,
      confidence: effectiveness >= 0.7 ? 'high' : effectiveness >= 0.5 ? 'medium' : 'low',
    };
  });

  // Aggregate gains
  const avgExposureReduction = domainDeltas.length > 0
    ? domainDeltas.reduce((s, d) => s + d.exposureReduction, 0) / domainDeltas.length
    : 0;

  const resilienceGain = Math.round(Math.min(40, avgExposureReduction * 0.5));
  const projectedScore = Math.min(100, baselineScore + resilienceGain);
  const exposureReductionPct = Math.round(avgExposureReduction);

  // Governance stabilization: how much does this help governance nodes?
  const govNodes = affectedNodes.filter((node) => node.category === 'governance' || node.category === 'compliance');
  const governanceStabilizationGain = govNodes.length > 0
    ? Math.round(getMitigationEffectivenessMultiplier(scenario.mitigationType, 'governance') * 60)
    : 0;

  // Dependency concentration reduction
  const singleSourceAffected = affectedNodes.filter((node) => node.isSingleSource).length;
  const dependencyConcentrationReduction = singleSourceAffected > 0
    ? Math.round(Math.min(50, singleSourceAffected * 10))
    : 0;

  // Continuity ROI classification
  const roi = resilienceGain >= 25 ? 'transformative'
    : resilienceGain >= 15 ? 'high'
    : resilienceGain >= 8 ? 'medium'
    : 'low';

  const implementationEffort =
    scenario.durationWeeks <= 8 ? 'weeks'
    : scenario.durationWeeks <= 20 ? 'months'
    : 'quarters';

  const projectionCurve = buildProjectionCurve(baselineScore, resilienceGain, scenario.durationWeeks);

  return {
    scenarioId,
    label,
    mitigationType: scenario.mitigationType,
    baselineScore,
    projectedScore,
    resilienceGain,
    exposureReductionPct,
    governanceStabilizationGain,
    dependencyConcentrationReduction,
    domainDeltas,
    projectionCurve,
    actionPlan: buildActionPlan(scenario),
    implementationEffort,
    continuityROI: roi,
  };
}

/**
 * Compare multiple continuity mitigation scenarios.
 * Returns side-by-side analysis with recommendation.
 */
export async function compareMitigations(
  orgId: string,
  scenarios: MitigationScenario[],
): Promise<MitigationComparison> {
  const [propagationMap, resilienceIndex] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    calculateResilienceIndex(orgId),
  ]);

  const baselineScore = resilienceIndex.overallScore;

  const results = await Promise.all(
    scenarios.map((s) => evaluateMitigationScenario(orgId, s, propagationMap, baselineScore)),
  );

  // Rank by resilience gain
  const sorted = [...results].sort((a, b) => b.resilienceGain - a.resilienceGain);
  const best = sorted[0];

  // Identify residual risks: single-source nodes not targeted by any scenario
  const allTargeted = new Set(scenarios.flatMap((s) => s.targetNodeIds));
  const residualNodes = propagationMap.nodes.filter(
    (node) => node.isSingleSource && !allTargeted.has(node.id),
  );
  const residualRisks = residualNodes.slice(0, 5).map(
    (node) => `${node.label} remains single-source (${node.continuitySensitivity} sensitivity)`,
  );

  const rationaleParts: string[] = [
    `Scenario "${best.label}" delivers the highest resilience gain (+${best.resilienceGain} points).`,
  ];
  if (best.governanceStabilizationGain > 20) {
    rationaleParts.push('It provides significant governance stabilization benefits.');
  }
  if (best.dependencyConcentrationReduction > 15) {
    rationaleParts.push('It meaningfully reduces operational dependency concentration.');
  }
  rationaleParts.push(`Implementation effort: ${best.implementationEffort}. ROI: ${best.continuityROI}.`);

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    baselineScore,
    scenarios: results,
    recommendedScenario: best.scenarioId,
    recommendationRationale: rationaleParts.join(' '),
    residualRisks,
  };
}
