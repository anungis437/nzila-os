/**
 * Governance Momentum Engine
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type { GovernanceMomentumProfile } from './momentum-models';

export async function modelGovernanceMomentum(
  organizationId: string,
): Promise<GovernanceMomentumProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmpty(organizationId);
  }

  const govCount = memory.entries.filter((e) => e.memoryType === 'governance_reasoning').length;
  const mitCount = memory.entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const contCount = memory.entries.filter((e) => e.memoryType === 'continuity_assessment').length;

  const maturityAccel = Math.min(100, (govCount / 10) * 100);
  const resilienceMomentum = Math.min(100, (mitCount / 10) * 100);
  const continuityVelocity = Math.min(100, (contCount / 8) * 100);
  const learningAccel = Math.min(100, (totalEntries / 30) * 100);
  const sustainability = Math.min(100, (totalEntries / 50) * 100);

  const overall = Math.round(
    (maturityAccel + resilienceMomentum + continuityVelocity + learningAccel + sustainability) / 5,
  );

  return {
    organizationId,
    momentum_indicators: {
      governance_maturity_acceleration: maturityAccel,
      resilience_momentum: resilienceMomentum,
      continuity_improvement_velocity: continuityVelocity,
      institutional_learning_acceleration: learningAccel,
      adaptation_sustainability: sustainability,
      evidence: [`${totalEntries} cognition entries; ${govCount} governance actions`],
    },
    overall_momentum_score: overall,
    acceleration_trend:
      overall >= 70 ? 'accelerating' : overall >= 50 ? 'steady' : overall >= 30 ? 'decelerating' : 'volatile',
    sustainability_rating: sustainability >= 60 ? 'high' : sustainability >= 30 ? 'moderate' : 'low',
    momentum_narrative:
      overall >= 60
        ? `Organization demonstrates strong governance momentum (${overall}/100).`
        : `Governance momentum is developing (${overall}/100).`,
    interpretationGuidance:
      overall < 40
        ? 'Reinforce governance cadence and learning loops.'
        : 'Sustain momentum with continuous adaptation cycles.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmpty(organizationId: string): GovernanceMomentumProfile {
  return {
    organizationId,
    momentum_indicators: {
      governance_maturity_acceleration: 0,
      resilience_momentum: 0,
      continuity_improvement_velocity: 0,
      institutional_learning_acceleration: 0,
      adaptation_sustainability: 0,
      evidence: ['Insufficient data'],
    },
    overall_momentum_score: 0,
    acceleration_trend: 'volatile',
    sustainability_rating: 'low',
    momentum_narrative: 'Insufficient data to model governance momentum.',
    interpretationGuidance: 'Establish baseline cognition memory.',
    entriesAnalyzed: 0,
  };
}

