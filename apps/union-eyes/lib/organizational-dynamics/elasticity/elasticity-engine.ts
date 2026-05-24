/**
 * Organizational Response Elasticity Engine
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type { OrganizationalResponseElasticityProfile } from './elasticity-models';

export async function measureOrganizationalElasticity(
  organizationId: string,
): Promise<OrganizationalResponseElasticityProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const entries = memory.entries;
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmpty(organizationId);
  }

  const respCount = entries.filter((e) => e.memoryType === 'resilience_baseline').length;
  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const contCount = entries.filter((e) => e.memoryType === 'continuity_assessment').length;
  const govCount = entries.filter((e) => e.memoryType === 'governance_reasoning').length;

  const responsiveness = Math.min(100, (respCount / Math.max(1, totalEntries)) * 200);
  const adaptationSpeed = Math.min(100, (mitCount / Math.max(1, totalEntries)) * 200);
  const recoveryElasticity = Math.min(100, (govCount / Math.max(1, totalEntries)) * 200);
  const stabilizationVelocity = Math.min(100, (contCount / Math.max(1, totalEntries)) * 200);

  const adaptability = Math.round(
    (responsiveness + adaptationSpeed + recoveryElasticity + stabilizationVelocity) / 4,
  );

  return {
    organizationId,
    elasticity_indicators: {
      resilience_responsiveness: responsiveness,
      mitigation_adaptation_speed: adaptationSpeed,
      governance_recovery_elasticity: recoveryElasticity,
      continuity_stabilization_velocity: stabilizationVelocity,
      institutional_recovery_trajectories:
        adaptability >= 60 ? 'Strong recovery trajectory across domains' : 'Emerging recovery capability',
      evidence: [`${respCount} responses, ${mitCount} mitigations, ${contCount} continuity plans`],
    },
    adaptability_score: adaptability,
    recovery_curve:
      adaptability >= 70 ? 'Sharp recovery curve' : adaptability >= 40 ? 'Gradual recovery curve' : 'Slow recovery curve',
    stress_response_pattern:
      adaptationSpeed >= 70 ? 'fast' : adaptationSpeed >= 40 ? 'moderate' : adaptationSpeed >= 20 ? 'slow' : 'oscillating',
    sustainability: adaptability >= 60 ? 'high' : adaptability >= 40 ? 'moderate' : 'low',
    interpretationGuidance:
      adaptability >= 60
        ? 'Maintain elasticity through routine drills and continuity reviews.'
        : 'Strengthen response cadence and continuity playbooks.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmpty(organizationId: string): OrganizationalResponseElasticityProfile {
  return {
    organizationId,
    elasticity_indicators: {
      resilience_responsiveness: 0,
      mitigation_adaptation_speed: 0,
      governance_recovery_elasticity: 0,
      continuity_stabilization_velocity: 0,
      institutional_recovery_trajectories: 'Insufficient data',
      evidence: ['Insufficient data'],
    },
    adaptability_score: 0,
    recovery_curve: 'Insufficient data',
    stress_response_pattern: 'oscillating',
    sustainability: 'low',
    interpretationGuidance: 'Establish baseline cognition memory.',
    entriesAnalyzed: 0,
  };
}

