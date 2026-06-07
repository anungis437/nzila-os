/**
 * Continuity Impact Simulator
 *
 * Simulates organizational continuity degradation under various scenarios
 * (retirement, sudden departure, vendor loss, governance knowledge loss, etc.).
 *
 * Outputs:
 * - Per-domain continuity impacts
 * - Degradation timeline (how quickly continuity collapses)
 * - Exposed/exacerbated resilience weaknesses
 * - Mitigation recommendations at 30/90 day horizons
 *
 * ORGANIZATIONALLY FRAMED — not about individuals, about organizational resilience.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import type { DependencyNode, PropagationMap } from '../propagation/propagation-models';
import type {
  SimulationScenario,
  SimulatedContinuityImpact,
  ContinuityDegradationTimeline,
  ResilienceWeaknessIndicator,
  ContinuitySimulationResult,
  SimulationType,
} from './simulation-models';
import {
  computeDomainDegradation,
  buildDegradationTimeline,
  estimateAutonomousRecoveryProbability,
} from './simulation-models';

type PublishedInterview = Awaited<ReturnType<typeof loadPublishedInterviews>>[number];

async function loadPublishedInterviews(orgId: string) {
  return db
    .select()
    .from(exitInterviews)
    .where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published')));
}

/**
 * Simulate continuity impact of a scenario (retirement, departure, vendor loss, etc.)
 */
export async function simulateContinuityImpact(
  orgId: string,
  scenario: SimulationScenario,
): Promise<ContinuitySimulationResult> {
  // Build propagation map (current organizational dependencies)
  const propagationMap = await buildDependencyPropagationMap(orgId);

  // Load baseline (current interviews for doc quality assessment)
  const interviews = await loadPublishedInterviews(orgId);

  // Calculate baseline continuity score
  const baselineContinuityScore = calculateBaselineContinuity(propagationMap, interviews.length);

  // Identify affected nodes
  const affectedNodes = propagationMap.nodes.filter((n) => scenario.affectedNodeIds.includes(n.id));
  if (affectedNodes.length === 0) {
    // Safety: if no direct matches, return minimal impact
    return buildMinimalSimulation(orgId, scenario, baselineContinuityScore);
  }

  // Compute per-domain impacts
  const domainImpacts = computeDomainImpacts(affectedNodes, propagationMap);

  // Compute immediate impact score
  const immediateImpactScore = domainImpacts.reduce((sum, d) => {
    const severity = d.impactSeverity === 'critical' ? 100 :
      d.impactSeverity === 'high' ? 75 :
      d.impactSeverity === 'medium' ? 50 :
      25;
    return sum + (severity * (d.degradationPercentage / 100)) / domainImpacts.length;
  }, 0);

  // 12-week projection (with acceleration)
  const twelveWeekProjection = projectContinuityScore(
    baselineContinuityScore,
    immediateImpactScore,
    affectedNodes.length,
    scenario.simulationType,
  );

  // Build degradation timeline
  const degradationTimeline = buildDegradationTimeline(
    immediateImpactScore,
    scenario.simulationType,
    affectedNodes.length,
  );

  // Identify exacerbated weaknesses
  const exacerbatedWeaknesses = identifyExacerbatedWeaknesses(affectedNodes, propagationMap);

  // Generate recommendations
  const { immediateActions, mitigation30Day, remediation90Day } = generateRecommendations(
    affectedNodes,
    propagationMap,
    exacerbatedWeaknesses,
  );

  // Estimate recovery effort
  const recoveryEffortEstimate = estimateRecoveryEffort(
    immediateImpactScore,
    exacerbatedWeaknesses.length,
    scenario.simulationType,
  );

  // Autonomous recovery probability
  const autonomousRecoveryProbability = estimateAutonomousRecoveryProbability(
    baselineContinuityScore,
    immediateImpactScore,
    assessDocumentationQuality(interviews, affectedNodes),
    assessRedundancy(affectedNodes, propagationMap),
  );

  // Governance impact
  const governanceBodiesAffected = affectedNodes
    .filter((n) => n.category === 'governance')
    .length;

  const complianceRiskCreated = affectedNodes.some((n) => n.category === 'compliance');

  // Executive summary
  const executiveSummary = generateExecutiveSummary(
    scenario,
    immediateImpactScore,
    degradationTimeline,
    exacerbatedWeaknesses,
  );

  // Overall severity
  const overallImpactSeverity =
    immediateImpactScore >= 80 ? 'critical' :
    immediateImpactScore >= 60 ? 'high' :
    immediateImpactScore >= 40 ? 'medium' :
    'low';

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    scenario,
    baselineContinuityScore,
    immediateImpactScore,
    twelveWeekProjection,
    overallImpactSeverity,
    domainImpacts,
    degradationTimeline,
    exacerbatedWeaknesses,
    immediateActions,
    mitigation30Day,
    remediation90Day,
    recoveryEffortEstimate,
    autonomousRecoveryProbability,
    governanceBodiesAffected,
    complianceRiskCreated,
    executiveSummary,
  };
}

function calculateBaselineContinuity(propagationMap: PropagationMap, interviewCount: number): number {
  let score = 70; // Baseline: org with some documentation

  // Single-source nodes reduce baseline
  const singleSourceCount = propagationMap.nodes.filter((node) => node.isSingleSource).length;
  score -= Math.min(singleSourceCount * 3, 30);

  // Interview count (more sources = better baseline)
  if (interviewCount >= 10) score += 10;
  else if (interviewCount >= 5) score += 5;

  // Bottleneck count
  score -= Math.min(propagationMap.bottlenecks.length * 2, 20);

  return Math.max(30, Math.min(score, 90));
}

function computeDomainImpacts(affectedNodes: DependencyNode[], _propagationMap: PropagationMap): SimulatedContinuityImpact[] {
  const impacts: SimulatedContinuityImpact[] = [];

  for (const node of affectedNodes) {
    // Assess documentation quality (heuristic: single-source = minimal, etc.)
    const docQuality = node.isSingleSource ? 'minimal' : 'partial';
    const redundancyLevel = node.isSingleSource ? 'none' : 'weak';

    const impact = computeDomainDegradation(
      docQuality as 'minimal' | 'partial' | 'good',
      redundancyLevel as 'none' | 'weak' | 'moderate' | 'strong',
      node.category === 'governance' || node.category === 'compliance',
      node.associatedRoles?.length ?? 1,
      node.category === 'vendor',
    );

    impacts.push({
      ...impact,
      domain: node.label || `${node.category} system`,
    });
  }

  return impacts;
}

function identifyExacerbatedWeaknesses(affectedNodes: DependencyNode[], _propagationMap: PropagationMap): ResilienceWeaknessIndicator[] {
  const weaknesses: ResilienceWeaknessIndicator[] = [];

  for (const node of affectedNodes) {
    // Single-source weakness
    if (node.isSingleSource) {
      weaknesses.push({
        weaknessType: 'single_source',
        affectedArea: node.label,
        severity: 'critical',
        isExacerbated: true,
        mitigation: `Immediately begin cross-training and documentation for ${node.label}`,
      });
    }

    // Vendor dependency weakness
    if (node.category === 'vendor') {
      weaknesses.push({
        weaknessType: 'vendor_dependency',
        affectedArea: node.label,
        severity: 'high',
        isExacerbated: true,
        mitigation: `Establish backup vendor relationships and documented procedures for ${node.label}`,
      });
    }

    // Governance gap
    if (node.category === 'governance' || node.category === 'compliance') {
      weaknesses.push({
        weaknessType: 'governance_gap',
        affectedArea: node.label,
        severity: 'critical',
        isExacerbated: true,
        mitigation: `Formalize governance procedures currently held informally in ${node.label}`,
      });
    }
  }

  return weaknesses;
}

function generateRecommendations(
  affectedNodes: DependencyNode[],
  _propagationMap: PropagationMap,
  _weaknesses: ResilienceWeaknessIndicator[],
): {
  immediateActions: string[];
  mitigation30Day: string[];
  remediation90Day: string[];
} {
  const immediateActions: string[] = [];
  const mitigation30Day: string[] = [];
  const remediation90Day: string[] = [];

  // Immediate actions (today)
  for (const node of affectedNodes.filter((affectedNode) => affectedNode.isSingleSource)) {
    immediateActions.push(`Lock down current knowledge: conduct detailed interview/documentation session with ${node.associatedRoles[0]}`);
  }
  immediateActions.push('Activate business continuity team');
  immediateActions.push('Notify dependent departments of potential service disruption');

  // 30-day mitigations
  for (const node of affectedNodes) {
    mitigation30Day.push(`Document ${node.label}: create runbooks and procedure guides`);
    if (node.category === 'vendor') {
      mitigation30Day.push(`Engage backup vendors for ${node.label}`);
    }
    if (node.category === 'system') {
      mitigation30Day.push(`Train backup operators for ${node.label} system`);
    }
  }
  mitigation30Day.push('Establish daily continuity briefings');
  mitigation30Day.push('Assess external support requirements');

  // 90-day remediations (long-term fixes)
  remediation90Day.push('Implement cross-training program for all single-source knowledge areas');
  remediation90Day.push('Formalize all governance processes currently held informally');
  remediation90Day.push('Diversify vendor relationships for critical external dependencies');
  remediation90Day.push('Establish automated system monitoring and failover procedures');
  remediation90Day.push('Create knowledge management system for organizational memory');

  return { immediateActions, mitigation30Day, remediation90Day };
}

function generateExecutiveSummary(
  scenario: SimulationScenario,
  impactScore: number,
  timeline: ContinuityDegradationTimeline[],
  weaknesses: ResilienceWeaknessIndicator[],
): string {
  const severity =
    impactScore >= 80 ? 'CRITICAL' :
    impactScore >= 60 ? 'HIGH' :
    impactScore >= 40 ? 'MODERATE' :
    'LOW';

  const criticalWeeks = timeline.findIndex((timelinePoint) => timelinePoint.healthScore < 30);
  const timePhrase = criticalWeeks >= 0 ? `within ${criticalWeeks} weeks` : 'within 12 weeks';

  const typeDescriptions: Record<string, string> = {
    retirement: 'retirement of key staff member',
    sudden_departure: 'unexpected departure of key staff',
    vendor_loss: 'loss of critical vendor relationship',
    governance_knowledge_loss: 'loss of governance expertise',
    undocumented_process_loss: 'loss of undocumented procedures',
    procedural_fragmentation: 'fragmentation of operational procedures',
    bottleneck_collapse: 'failure of critical operational bottleneck',
  };

  return `Simulation of ${typeDescriptions[scenario.simulationType]} shows ${severity} organizational impact (${Math.round(impactScore)}% operational disruption). Continuity health would degrade to critical levels ${timePhrase}. Key vulnerabilities: ${weaknesses.slice(0, 2).map((w) => w.affectedArea).join(', ')}. Immediate action required to secure knowledge transfer and establish redundancy.`;
}

function estimateRecoveryEffort(
  impactScore: number,
  weaknessCount: number,
  _scenarioType: SimulationType,
): 'low' | 'medium' | 'high' | 'extreme' {
  if (impactScore >= 80 && weaknessCount >= 3) return 'extreme';
  if (impactScore >= 60 && weaknessCount >= 2) return 'high';
  if (impactScore >= 40) return 'medium';
  return 'low';
}

function projectContinuityScore(
  baseline: number,
  immediateImpact: number,
  affectedNodeCount: number,
  scenarioType: SimulationType,
): number {
  let score = baseline - immediateImpact;

  // Scenario-specific degradation over 12 weeks
  const weeklyDegradation = (immediateImpact * 0.05) + (affectedNodeCount * 2);
  score -= weeklyDegradation * 12;

  // Acceleration based on scenario type
  if (scenarioType === 'bottleneck_collapse') {
    score *= 0.7; // 30% additional degradation
  } else if (scenarioType === 'sudden_departure') {
    score *= 0.8; // 20% additional degradation
  }

  return Math.max(0, Math.min(score, 100));
}

function assessDocumentationQuality(interviews: PublishedInterview[], affectedNodes: DependencyNode[]): 'minimal' | 'partial' | 'good' {
  const totalInterviews = interviews.length;
  const singleSourceCount = affectedNodes.filter((node) => node.isSingleSource).length;

  if (totalInterviews >= 8 && singleSourceCount === 0) return 'good';
  if (totalInterviews >= 4) return 'partial';
  return 'minimal';
}

function assessRedundancy(affectedNodes: DependencyNode[], _propagationMap: PropagationMap): 'none' | 'weak' | 'moderate' | 'strong' {
  const singleSourceCount = affectedNodes.filter((node) => node.isSingleSource).length;

  if (singleSourceCount === affectedNodes.length) return 'none';
  if (singleSourceCount >= Math.ceil(affectedNodes.length * 0.5)) return 'weak';
  return 'moderate';
}

function buildMinimalSimulation(
  orgId: string,
  scenario: SimulationScenario,
  baselineContinuityScore: number,
): ContinuitySimulationResult {
  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    scenario,
    baselineContinuityScore,
    immediateImpactScore: 20,
    twelveWeekProjection: baselineContinuityScore - 15,
    overallImpactSeverity: 'low',
    domainImpacts: [],
    degradationTimeline: [],
    exacerbatedWeaknesses: [],
    immediateActions: ['Review scenario parameters and retry'],
    mitigation30Day: [],
    remediation90Day: [],
    recoveryEffortEstimate: 'low',
    autonomousRecoveryProbability: 85,
    governanceBodiesAffected: 0,
    complianceRiskCreated: false,
    executiveSummary: 'Scenario parameters did not match available organizational knowledge. Review and retry.',
  };
}
