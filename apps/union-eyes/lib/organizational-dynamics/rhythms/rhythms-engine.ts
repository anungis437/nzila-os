/**
 * Organizational Operating Rhythm Engine
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type { OperatingRhythmProfile, GovernanceReviewRhythm } from './rhythms-models';

function frequencyFromCount(count: number): GovernanceReviewRhythm['frequency'] {
  if (count >= 12) return 'weekly';
  if (count >= 6) return 'monthly';
  if (count >= 3) return 'quarterly';
  if (count >= 1) return 'annual';
  if (count === 0) return 'irregular';
  return 'ad_hoc';
}

export async function analyzeInstitutionalRhythms(
  organizationId: string,
): Promise<OperatingRhythmProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const entries = memory.entries;
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmpty(organizationId);
  }

  const govCount = entries.filter((e) => e.memoryType === 'governance_reasoning').length;
  const contCount = entries.filter((e) => e.memoryType === 'continuity_assessment').length;
  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;

  const reviewRhythm: GovernanceReviewRhythm = {
    frequency: frequencyFromCount(govCount),
    consistency: Math.min(100, (govCount / 10) * 100),
    adherence: 75,
    evidence: [`${govCount} governance reviews tracked`],
  };

  return {
    organizationId,
    governanceReviewRhythm: reviewRhythm,
    continuityPlanningCadence: {
      frequency: frequencyFromCount(contCount),
      consistency: Math.min(100, (contCount / 8) * 100),
    },
    mitigationImplementationCycles: {
      averageCycleDays: mitCount > 0 ? Math.round(90 / Math.max(1, mitCount)) : 0,
      variance: 30,
    },
    operationalStabilizationTiming: {
      averageDays: 14,
      predictability: Math.min(100, (totalEntries / 30) * 100),
    },
    resilienceAdaptationFrequency: {
      adaptationsPerYear: mitCount + contCount,
      trend: mitCount + contCount >= 4 ? 'increasing' : 'stable',
    },
    rhythmProfile:
      reviewRhythm.frequency === 'weekly' || reviewRhythm.frequency === 'monthly'
        ? 'High-cadence operating rhythm with regular governance review cycles.'
        : 'Moderate operating cadence; opportunity to formalize review rhythm.',
    rhythmStability: Math.min(100, (totalEntries / 30) * 100),
    interpretationGuidance:
      'Sustainable operating rhythm depends on consistent governance and continuity cadence.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmpty(organizationId: string): OperatingRhythmProfile {
  return {
    organizationId,
    governanceReviewRhythm: {
      frequency: 'irregular',
      consistency: 0,
      adherence: 0,
      evidence: ['Insufficient data'],
    },
    continuityPlanningCadence: { frequency: 'irregular', consistency: 0 },
    mitigationImplementationCycles: { averageCycleDays: 0, variance: 0 },
    operationalStabilizationTiming: { averageDays: 0, predictability: 0 },
    resilienceAdaptationFrequency: { adaptationsPerYear: 0, trend: 'stable' },
    rhythmProfile: 'Insufficient data to characterize operating rhythm.',
    rhythmStability: 0,
    interpretationGuidance: 'Build cognition memory to establish rhythm baseline.',
    entriesAnalyzed: 0,
  };
}

