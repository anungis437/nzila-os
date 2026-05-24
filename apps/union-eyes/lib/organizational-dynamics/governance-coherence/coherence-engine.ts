/**
 * Governance Coherence Engine
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory';
import type {
  GovernanceCoherenceProfile,
  GovernanceCoherenceScore,
  CoordinationBreakdownIndicator,
} from './coherence-models';

export async function evaluateGovernanceCoherence(
  organizationId: string,
): Promise<GovernanceCoherenceProfile> {
  const memory = await loadCognitionMemory(organizationId, { limit: 100 });
  const entries = memory.entries;
  const totalEntries = memory.totalEntries;

  if (totalEntries === 0) {
    return buildEmptyProfile(organizationId);
  }

  const govEntries = entries.filter((e) => e.memoryType === 'governance_reasoning');
  const contEntries = entries.filter((e) => e.memoryType === 'continuity_assessment');
  const mitEntries = entries.filter((e) => e.memoryType === 'mitigation_comparison');

  const govCount = govEntries.length;
  const contCount = contEntries.length;
  const mitCount = mitEntries.length;

  const procedural = Math.min(100, (govCount / Math.max(1, totalEntries)) * 200);
  const fragmentation = Math.max(0, 100 - procedural);
  const policyAlignment = Math.min(100, ((govCount + contCount) / Math.max(1, totalEntries)) * 150);
  const synchronization = Math.min(100, (Math.min(govCount, contCount) / Math.max(1, Math.max(govCount, contCount))) * 100);

  const dimensions: GovernanceCoherenceScore[] = [
    {
      dimension: 'procedural_consistency',
      score: procedural,
      strength: procedural >= 70 ? 'strong' : procedural >= 50 ? 'adequate' : procedural >= 30 ? 'weak' : 'critical',
      trend: 'stable',
      evidence: [`${govCount} governance actions in ${totalEntries} entries`],
      recommendation: 'Maintain governance documentation cadence',
    },
    {
      dimension: 'governance_fragmentation',
      score: 100 - fragmentation,
      strength: fragmentation < 30 ? 'strong' : fragmentation < 50 ? 'adequate' : 'weak',
      trend: 'stable',
      evidence: [`Fragmentation index ${Math.round(fragmentation)}`],
      recommendation: 'Consolidate governance touchpoints across silos',
    },
    {
      dimension: 'continuity_synchronization',
      score: synchronization,
      strength: synchronization >= 60 ? 'adequate' : 'weak',
      trend: 'stable',
      evidence: [`Gov/cont balance: ${govCount}/${contCount}`],
      recommendation: 'Align continuity planning with governance reviews',
    },
  ];

  const breakdowns: CoordinationBreakdownIndicator[] = [];
  if (mitCount > govCount * 2) {
    breakdowns.push({
      breakdownFactor: 'mitigation_outpaces_governance',
      severity: 'high',
      affectedDomains: ['governance', 'operational'],
      frequency: 60,
      recoveryTime: 14,
      evidence: [`${mitCount} mitigations vs ${govCount} governance actions`],
    });
  }

  const overall = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(1, dimensions.length),
  );

  return {
    organizationId,
    overallCoherenceScore: overall,
    dimensions,
    proceduralConsistency: {
      consistency: procedural,
      uniformityAcrossDomains: procedural,
      variationPattern: procedural >= 70 ? 'uniform' : procedural >= 40 ? 'gradually_varying' : 'fragmented',
      evidence: [`${govCount} governance actions`],
    },
    governanceFragmentation: {
      fragmentationLevel: fragmentation,
      siloCount: Math.max(1, Math.round(fragmentation / 25)),
      communicationBreakpoints: Math.round(fragmentation / 20),
      crossSiloCoordination: 100 - fragmentation,
      evidence: [`Fragmentation ${Math.round(fragmentation)}/100`],
    },
    policyAlignment: {
      alignmentScore: policyAlignment,
      conflictingPolicies: [],
      gapAreas: contCount === 0 ? ['continuity_policy_missing'] : [],
      alignmentTrend: 'stable',
      evidence: [`Policy alignment ${Math.round(policyAlignment)}/100`],
    },
    continuitySynchronization: {
      synchronization,
      timingConsistency: synchronization,
      dependencyAlignment: synchronization,
      reciprocalSupport: synchronization,
      evidence: [`Sync ${Math.round(synchronization)}/100`],
    },
    operationalGovernanceOverlap: {
      overlapScore: 50,
      ambiguousAuthority: 40,
      decisionDelays: mitCount > govCount * 2 ? 60 : 30,
      duplicationLevel: 30,
      evidence: ['Baseline overlap analysis'],
    },
    coordinationBreakdowns: breakdowns,
    fragmentationMap: {
      governanceSilos: [],
      communicationBreakpoints: [],
      integrationGaps: [],
    },
    synchronizationMap: {
      alignedInitiatives: [],
      misalignedInitiatives: [],
    },
    coherenceNarrative: `Overall governance coherence ${overall}/100. ${breakdowns.length > 0 ? 'Coordination breakdowns detected.' : 'No critical breakdowns observed.'}`,
    criticalCoherenceIssues: dimensions.filter((d) => d.strength === 'critical' || d.strength === 'weak'),
    interpretationGuidance:
      overall < 40
        ? 'Coherence is critically low — convene cross-domain governance review.'
        : 'Sustain coherence by aligning continuity and governance cadences.',
    entriesAnalyzed: totalEntries,
  };
}

function buildEmptyProfile(organizationId: string): GovernanceCoherenceProfile {
  return {
    organizationId,
    overallCoherenceScore: 0,
    dimensions: [],
    proceduralConsistency: {
      consistency: 0,
      uniformityAcrossDomains: 0,
      variationPattern: 'fragmented',
      evidence: ['Insufficient data'],
    },
    governanceFragmentation: {
      fragmentationLevel: 0,
      siloCount: 0,
      communicationBreakpoints: 0,
      crossSiloCoordination: 0,
      evidence: ['Insufficient data'],
    },
    policyAlignment: {
      alignmentScore: 0,
      conflictingPolicies: [],
      gapAreas: [],
      alignmentTrend: 'stable',
      evidence: ['Insufficient data'],
    },
    continuitySynchronization: {
      synchronization: 0,
      timingConsistency: 0,
      dependencyAlignment: 0,
      reciprocalSupport: 0,
      evidence: ['Insufficient data'],
    },
    operationalGovernanceOverlap: {
      overlapScore: 0,
      ambiguousAuthority: 0,
      decisionDelays: 0,
      duplicationLevel: 0,
      evidence: ['Insufficient data'],
    },
    coordinationBreakdowns: [],
    fragmentationMap: { governanceSilos: [], communicationBreakpoints: [], integrationGaps: [] },
    synchronizationMap: { alignedInitiatives: [], misalignedInitiatives: [] },
    coherenceNarrative: 'Insufficient cognition memory to evaluate governance coherence.',
    criticalCoherenceIssues: [],
    interpretationGuidance: 'Begin governance cognition memory accumulation.',
    entriesAnalyzed: 0,
  };
}

