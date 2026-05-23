/**
 * Operational Coordination Engine
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type {
  OperationalCoordinationProfile,
  CoordinationBottleneck,
} from './coordination-models';

export async function modelCoordinationBehavior(
  organizationId: string,
): Promise<OperationalCoordinationProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const entries = memory.entries;
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmpty(organizationId);
  }

  const govCount = entries.filter((e) => e.memoryType === 'governance_reasoning').length;
  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const contCount = entries.filter((e) => e.memoryType === 'continuity_assessment').length;
  const respCount = entries.filter((e) => e.memoryType === 'resilience_baseline').length;

  const efficiency = Math.min(100, (totalEntries / 30) * 100);
  const bottlenecks: OperationalCoordinationProfile['bottlenecks'] = [];

  if (govCount < 3 && (mitCount > 0 || contCount > 0)) {
    bottlenecks.push({
      bottleneck: 'governance_authorization' as CoordinationBottleneck,
      severity: 'high',
      frequency: 70,
      impactedInteractions: mitCount + contCount,
      evidence: [`Only ${govCount} governance actions for ${mitCount + contCount} downstream actions`],
    });
  }
  if (respCount > 0 && contCount === 0) {
    bottlenecks.push({
      bottleneck: 'procedural_handoff',
      severity: 'moderate',
      frequency: 50,
      impactedInteractions: respCount,
      evidence: [`${respCount} responses without continuity plan`],
    });
  }

  return {
    organizationId,
    overallCoordinationScore: Math.max(0, efficiency - bottlenecks.length * 10),
    bottlenecks,
    efficiencyIndicators: [
      {
        efficiency,
        responseLatency: bottlenecks.length > 0 ? 7 : 3,
        synchronizationQuality: efficiency,
        dependencyTracking: efficiency,
        evidence: [`${totalEntries} cognition entries`],
      },
    ],
    synchronizationMap: {
      governanceResponseTime: 5,
      continuityResponseTime: 7,
      mitigationResponseTime: 3,
      maxResponseTime: 7,
      synchronizationScore: efficiency,
      evidence: [`Coordination across ${totalEntries} entries`],
    },
    trajectory: {
      efficiency,
      trend: totalEntries > 10 ? 'improving' : 'insufficient_data',
      coordinationMomentum: efficiency,
      sustainability: efficiency >= 60 ? 'high' : efficiency >= 40 ? 'moderate' : 'low',
      evidence: [`Coordination momentum derived from ${totalEntries} entries`],
    },
    coordinationNarrative: `Coordination efficiency ${Math.round(efficiency)}/100 with ${bottlenecks.length} bottlenecks.`,
    interpretationGuidance:
      bottlenecks.length > 0
        ? 'Address identified bottlenecks to improve coordination.'
        : 'Maintain coordination practices and tracking.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmpty(organizationId: string): OperationalCoordinationProfile {
  return {
    organizationId,
    overallCoordinationScore: 0,
    bottlenecks: [],
    efficiencyIndicators: [],
    synchronizationMap: {
      governanceResponseTime: 0,
      continuityResponseTime: 0,
      mitigationResponseTime: 0,
      maxResponseTime: 0,
      synchronizationScore: 0,
      evidence: ['Insufficient data'],
    },
    trajectory: {
      efficiency: 0,
      trend: 'insufficient_data',
      coordinationMomentum: 0,
      sustainability: 'low',
      evidence: ['Insufficient data'],
    },
    coordinationNarrative: 'Insufficient data to model coordination behavior.',
    interpretationGuidance: 'Establish baseline coordination tracking.',
    entriesAnalyzed: 0,
  };
}

