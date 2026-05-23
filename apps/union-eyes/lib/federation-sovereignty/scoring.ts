/**
 * Sovereignty readiness scoring engine.
 *
 * Computes a composite, shadow-mode-only organizational readiness assessment
 * across four dimensions:
 *
 *   - Autonomy       (30%) — sovereignty modes across federation units
 *   - Delegation     (25%) — delegation chain validity and conflicts
 *   - Continuity     (25%) — continuity resilience and sharing
 *   - Jurisdiction   (20%) — audit visibility and AI governance consistency
 *
 * Output is never exposed to users. Internal evidence only.
 *
 * @module lib/federation-sovereignty/scoring
 */

import type {
  SovereignGovernanceContract,
  SovereigntyReadinessAssessment,
  FederationAutonomyScore,
  GovernanceDelegationScore,
  JurisdictionIntegrityScore,
} from './types';
import { resolveEffectiveSovereigntyMode } from './autonomy';
import { evaluateAllDelegations } from './delegation';
import { snapshotContinuityResilience } from './coordination';
import { getAllSimulationScenarios } from './simulation';

// ── Autonomy score ────────────────────────────────────────────────────────────

function computeAutonomyScore(
  contracts: SovereignGovernanceContract[],
): FederationAutonomyScore {
  if (contracts.length === 0) {
    return { score: 100, unitsAssessed: 0, fullyAutonomousUnits: 0, restrictedUnits: 0 };
  }

  let fullyAutonomousUnits = 0;
  let restrictedUnits = 0;

  for (const contract of contracts) {
    const mode = resolveEffectiveSovereigntyMode(contract);
    if (mode === 'fully-autonomous') fullyAutonomousUnits++;
    if (mode === 'restricted' || mode === 'oversight-required') restrictedUnits++;
  }

  const restrictionPenalty = (restrictedUnits / contracts.length) * 30;
  const score = Math.max(0, Math.min(100, 100 - restrictionPenalty));

  return {
    score,
    unitsAssessed: contracts.length,
    fullyAutonomousUnits,
    restrictedUnits,
  };
}

// ── Delegation score ──────────────────────────────────────────────────────────

function computeDelegationScore(
  contracts: SovereignGovernanceContract[],
): GovernanceDelegationScore {
  if (contracts.length === 0) {
    return { score: 100, delegationGrantsValid: 0, conflictsDetected: 0, subDelegationExposure: 0 };
  }

  let validGrants = 0;
  let conflictsDetected = 0;
  let subDelegationExposure = 0;

  for (const contract of contracts) {
    const allResults = evaluateAllDelegations(contract);
    for (const [, result] of allResults) {
      if (result.granted) validGrants++;
      if (result.conflicts.length > 0) conflictsDetected++;
      if (result.subDelegationAllowed) subDelegationExposure++;
    }
  }

  const conflictPenalty = conflictsDetected * 5;
  const exposurePenalty = subDelegationExposure * 2;
  const score = Math.max(0, Math.min(100, 100 - conflictPenalty - exposurePenalty));

  return {
    score,
    delegationGrantsValid: validGrants,
    conflictsDetected,
    subDelegationExposure,
  };
}

// ── Jurisdiction score ────────────────────────────────────────────────────────

function computeJurisdictionScore(
  contracts: SovereignGovernanceContract[],
): JurisdictionIntegrityScore {
  if (contracts.length === 0) {
    return {
      score: 100,
      auditVisibilityPoliciesValid: 0,
      overrideViolationsDetected: 0,
      aiJurisdictionConsistent: true,
    };
  }

  let validPolicies = 0;
  let overrideViolations = 0;

  for (const contract of contracts) {
    const visibilityScopesInOrder: Array<'local' | 'regional' | 'national' | 'federated'> = [
      'local', 'regional', 'national', 'federated',
    ];
    const validScope = visibilityScopesInOrder.includes(contract.auditVisibility);
    if (validScope) validPolicies++;

    const hasAI = contract.delegatedAuthorities.includes('ai-operations');
    const aiRestricted = contract.overrideRestrictions.includes('ai-operations');
    if (hasAI && aiRestricted) overrideViolations++;
  }

  const aiJurisdictionConsistent = contracts.every((c) => {
    const hasAI = c.delegatedAuthorities.includes('ai-operations');
    const aiRestricted = c.overrideRestrictions.includes('ai-operations');
    return !(hasAI && aiRestricted);
  });

  const violationPenalty = overrideViolations * 10;
  const score = Math.max(0, Math.min(100, 100 - violationPenalty));

  return {
    score,
    auditVisibilityPoliciesValid: validPolicies,
    overrideViolationsDetected: overrideViolations,
    aiJurisdictionConsistent,
  };
}

// ── Composite scoring ─────────────────────────────────────────────────────────

const WEIGHTS = {
  autonomy: 0.30,
  delegation: 0.25,
  continuity: 0.25,
  jurisdiction: 0.20,
} as const;

/**
 * Compute a composite sovereignty readiness assessment.
 *
 * Shadow-mode only. Never exposed publicly.
 */
export function computeSovereigntyReadiness(
  contracts: SovereignGovernanceContract[],
): SovereigntyReadinessAssessment {
  const autonomy = computeAutonomyScore(contracts);
  const delegation = computeDelegationScore(contracts);
  const continuity = snapshotContinuityResilience(contracts);
  const jurisdiction = computeJurisdictionScore(contracts);

  const overall =
    autonomy.score * WEIGHTS.autonomy +
    delegation.score * WEIGHTS.delegation +
    continuity.score * WEIGHTS.continuity +
    jurisdiction.score * WEIGHTS.jurisdiction;

  return {
    overall: Math.round(overall * 10) / 10,
    autonomy,
    delegation,
    continuity,
    jurisdiction,
    simulationCount: getAllSimulationScenarios().length,
    governanceMode: 'shadow',
    generatedAt: new Date().toISOString(),
  };
}
