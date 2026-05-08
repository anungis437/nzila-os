/**
 * Institutional Systems Dynamics Engine
 *
 * Derives systems-level institutional behavior from cognition memory.
 * Organizational analysis only — never employee-level.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type {
  SystemsDynamicsProfile,
  GovernanceFlowPattern,
  ContinuityMomentum,
  CoordinationFriction,
  InstitutionalInertia,
  ResilienceAcceleration,
  GovernanceStabilizationVelocity,
  SystemsCoherenceIndicator,
  InstitutionalStabilitySignal,
} from './systems-models';

export async function analyzeSystemsDynamics(
  organizationId: string,
): Promise<SystemsDynamicsProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const entries = memory.entries;
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmptyProfile(organizationId);
  }

  const govCount = entries.filter((e) => e.memoryType === 'governance_reasoning').length;
  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const contCount = entries.filter((e) => e.memoryType === 'continuity_assessment').length;
  const respCount = entries.filter((e) => e.memoryType === 'resilience_baseline').length;

  let pattern: GovernanceFlowPattern = 'linear_progression';
  if (govCount === 0) pattern = 'stalled_governance';
  else if (govCount >= 5 && govCount > contCount) pattern = 'accelerating_momentum';
  else if (govCount < 3) pattern = 'fragmented_channels';

  const govVelocity = Math.min(100, (govCount / Math.max(1, totalEntries)) * 200);
  const contVelocity = Math.min(100, (contCount / Math.max(1, totalEntries)) * 200);

  const continuityMomentum: ContinuityMomentum = {
    velocity: contVelocity,
    direction:
      contCount === 0
        ? 'stalled'
        : contCount >= 5
        ? 'accelerating'
        : contCount <= 1
        ? 'decelerating'
        : 'steady',
    consistency: 50,
    sustainabilityRisk: contCount < 3 ? 'high' : contCount < 10 ? 'moderate' : 'low',
    evidence: [`${contCount} continuity plans across ${totalEntries} entries`],
  };

  const frictions: CoordinationFriction[] = [];
  if (govCount < 5 && mitCount > 5) {
    frictions.push({
      frictionArea: 'governance_operational_overlap',
      severity: mitCount > govCount * 2 ? 'high' : 'moderate',
      affectedDomains: ['governance', 'operational'],
      frequency: 60,
      evidence: [`Mitigation actions (${mitCount}) outpace governance oversight (${govCount})`],
      recommendation: 'Strengthen governance oversight cadence',
    });
  }

  const inertia: InstitutionalInertia[] = [];
  if (totalEntries < 20) {
    inertia.push({
      inertiaSource: 'organizational_memory_lag',
      strength: 60,
      mitigationReadiness: 45,
      historicalContext: 'Limited cognition memory accumulation',
      evidence: [`${totalEntries} memory entries`],
    });
  }

  const resilienceAcceleration: ResilienceAcceleration = {
    trajectory:
      respCount + mitCount === 0
        ? 'insufficient_history'
        : respCount > mitCount
        ? 'accelerating'
        : 'maintaining',
    velocity: Math.min(100, ((mitCount + respCount) / Math.max(1, totalEntries)) * 100),
    sustainedPeriods: respCount > 3 ? 2 : 1,
    interruptionRisk: respCount > 3 ? 'low' : 'moderate',
    evidence: [`${respCount} risk responses, ${mitCount} mitigations`],
  };

  const governanceStabilizationVelocity: GovernanceStabilizationVelocity = {
    velocity: Math.min(100, (totalEntries / 30) * 100),
    recoveryPattern: totalEntries < 5 ? 'insufficient_data' : 'gradual_stabilization',
    averageRecoveryDays: 7,
    volatilityTrend: totalEntries > 8 ? 'improving' : 'stable',
    evidence: [`${totalEntries} cognition entries`],
  };

  const coherenceIndicators: SystemsCoherenceIndicator[] = [
    {
      dimension: 'governance',
      coherenceScore: Math.min(100, (govCount / 10) * 100),
      pattern: govCount > 5 ? 'strong_governance' : 'weak_governance',
      fragmentationRisk: govCount < 3 ? 80 : 20,
      evidence: [`${govCount} governance actions`],
    },
    {
      dimension: 'continuity',
      coherenceScore: Math.min(100, (contCount / 8) * 100),
      pattern: contCount > 3 ? 'active_planning' : 'minimal_planning',
      fragmentationRisk: contCount < 2 ? 70 : 15,
      evidence: [`${contCount} continuity plans`],
    },
  ];

  const stabilitySignals: InstitutionalStabilitySignal[] = [
    {
      signalType: 'governance_stability',
      signal: govVelocity > 50 ? 'strengthening' : 'stable',
      strength: govVelocity,
      confidence: 75,
      evidence: [`${govCount} governance actions`],
    },
    {
      signalType: 'continuity_momentum',
      signal: continuityMomentum.direction === 'accelerating' ? 'strengthening' : continuityMomentum.direction === 'stalled' ? 'weakening' : 'stable',
      strength: contVelocity,
      confidence: 70,
      evidence: continuityMomentum.evidence,
    },
  ];

  const overallSystemsHealth = Math.round(
    govVelocity * 0.3 + contVelocity * 0.25 + Math.max(0, 100 - frictions.length * 15) * 0.2 + Math.max(0, 100 - inertia.length * 20) * 0.25,
  );

  return {
    organizationId,
    governanceFlow: {
      pattern,
      velocity: govVelocity,
      consistency: 60,
      blockages: govVelocity < 30 ? ['governance_operational_overlap'] : [],
      evidence: [`${govCount} governance actions tracked`],
    },
    continuityMomentum,
    coordinationFrictions: frictions,
    institutionalInertia: inertia,
    resilienceAcceleration,
    governanceStabilizationVelocity,
    coherenceIndicators,
    stabilitySignals,
    overallSystemsHealth,
    systemsNarrative: `Systems exhibit ${pattern} with ${overallSystemsHealth > 60 ? 'strong' : 'developing'} institutional coherence.`,
    criticalFrictions: frictions.filter((f) => f.severity === 'critical' || f.severity === 'high'),
    interpretationGuidance:
      overallSystemsHealth < 30
        ? 'Critical systems intervention recommended.'
        : 'Continue strengthening governance-continuity alignment.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmptyProfile(organizationId: string): SystemsDynamicsProfile {
  return {
    organizationId,
    governanceFlow: {
      pattern: 'fragmented_channels',
      velocity: 0,
      consistency: 0,
      blockages: [],
      evidence: ['Insufficient data'],
    },
    continuityMomentum: {
      velocity: 0,
      direction: 'stalled',
      consistency: 0,
      sustainabilityRisk: 'insufficient_data',
      evidence: ['Insufficient data'],
    },
    coordinationFrictions: [],
    institutionalInertia: [],
    resilienceAcceleration: {
      trajectory: 'insufficient_history',
      velocity: 0,
      sustainedPeriods: 0,
      interruptionRisk: 'high',
      evidence: ['Insufficient data'],
    },
    governanceStabilizationVelocity: {
      velocity: 0,
      recoveryPattern: 'insufficient_data',
      averageRecoveryDays: 0,
      volatilityTrend: 'stable',
      evidence: ['Insufficient data'],
    },
    coherenceIndicators: [],
    stabilitySignals: [],
    overallSystemsHealth: 0,
    systemsNarrative: 'Insufficient organizational data to analyze systems dynamics.',
    criticalFrictions: [],
    interpretationGuidance: 'Begin tracking institutional dynamics by establishing baseline cognition memory.',
    entriesAnalyzed: 0,
  };
}

