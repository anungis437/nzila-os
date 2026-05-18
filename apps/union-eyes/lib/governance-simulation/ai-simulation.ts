/**
 * AI governance simulation module.
 *
 * Simulates AI governance escalation paths, human-review triggers,
 * federation restrictions, and risk reclassification.
 *
 * IMPORTANT: This module simulates governance OUTCOMES only.
 * It does not execute AI or call any AI service.
 *
 * @module lib/governance-simulation/ai-simulation
 */

import type {
  GovernanceSimulationScenario,
  AISimulationResult,
} from './types';
import type { AIActionRisk } from '../governance-policy/types';

// ── Risk tier derivation ──────────────────────────────────────────────────────

/**
 * Derive AI risk tier from scenario sensitivity and stress type.
 * Mirrors the production ai-governance.ts classification without calling it.
 */
function deriveRiskTier(
  scenario: GovernanceSimulationScenario,
): AIActionRisk {
  if (scenario.stressType === 'ai-governance-risk') {
    if (scenario.governanceSensitivity === 'critical') return 'restricted';
    if (scenario.governanceSensitivity === 'high') return 'sensitive';
    if (scenario.governanceSensitivity === 'moderate') return 'advisory';
    return 'assistive';
  }

  // Non-AI scenarios shouldn't reach this module, but fall back safely
  if (scenario.governanceSensitivity === 'critical') return 'restricted';
  if (scenario.governanceSensitivity === 'high') return 'sensitive';
  return 'assistive';
}

// ── Human review requirement ──────────────────────────────────────────────────

function requiresHumanReview(riskTier: AIActionRisk): boolean {
  return riskTier === 'restricted' || riskTier === 'sensitive';
}

// ── Escalation evaluation ─────────────────────────────────────────────────────

function shouldEscalate(
  riskTier: AIActionRisk,
  scenario: GovernanceSimulationScenario,
): boolean {
  if (riskTier === 'restricted') return true;
  if (riskTier === 'sensitive' && scenario.escalationExpected) return true;
  if (scenario.incidentClass === 'ai-escalation-failure') return true;
  return false;
}

// ── Risk reclassification ─────────────────────────────────────────────────────

function checkRiskReclassification(
  scenario: GovernanceSimulationScenario,
): boolean {
  // The advisory-to-restricted transition scenario
  return (
    scenario.incidentClass === 'ai-escalation-failure' ||
    (scenario.stressType === 'ai-governance-risk' &&
      scenario.simulatedPolicies.some((p) => p.includes('assistive')) &&
      scenario.simulatedPolicies.some((p) => p.includes('sensitive')))
  );
}

// ── Federation restriction check ──────────────────────────────────────────────

function checkFederationRestriction(
  scenario: GovernanceSimulationScenario,
): boolean {
  return (
    scenario.stressType === 'federation-conflict' &&
    scenario.scope === 'ai-operation'
  );
}

// ── Operation blocking ────────────────────────────────────────────────────────

function shouldBlockOperation(
  riskTier: AIActionRisk,
  federationRestricted: boolean,
): boolean {
  if (federationRestricted) return true;
  if (riskTier === 'restricted') return true;
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simulate AI governance outcomes for a scenario.
 *
 * Returns an `AISimulationResult` with the expected governance path:
 *   - risk classification
 *   - human review trigger
 *   - escalation
 *   - federation restrictions
 *   - operation blocking
 *
 * Never throws; errors are captured in `diagnostics`.
 */
export function simulateAIGovernance(
  scenario: GovernanceSimulationScenario,
): AISimulationResult {
  try {
    const riskTier = deriveRiskTier(scenario);
    const humanReviewRequired = requiresHumanReview(riskTier);
    const escalationTriggered = shouldEscalate(riskTier, scenario);
    const riskReclassified = checkRiskReclassification(scenario);
    const federationRestrictionApplied = checkFederationRestriction(scenario);
    const operationBlocked = shouldBlockOperation(riskTier, federationRestrictionApplied);

    // Audit emission: always for sensitive/restricted or escalated operations
    const auditEmitted =
      riskTier === 'restricted' ||
      riskTier === 'sensitive' ||
      escalationTriggered ||
      operationBlocked;

    return {
      scenarioId: scenario.id,
      riskTier,
      humanReviewRequired,
      escalationTriggered,
      federationRestrictionApplied,
      operationBlocked,
      riskReclassified,
      auditEmitted,
      diagnostics: {
        scope: scenario.scope,
        stressType: scenario.stressType ?? null,
        sensitivity: scenario.governanceSensitivity,
        simulatedPolicies: scenario.simulatedPolicies,
        governanceMode: 'shadow' as const,
        note: 'AI simulation is outcome-only. No AI service was called.',
      },
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      riskTier: 'assistive',
      humanReviewRequired: false,
      escalationTriggered: false,
      federationRestrictionApplied: false,
      operationBlocked: false,
      riskReclassified: false,
      auditEmitted: false,
      diagnostics: { error: String(err), governanceMode: 'shadow' as const },
    };
  }
}
