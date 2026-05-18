/**
 * Federation conflict simulator.
 *
 * Simulates governance inheritance resolution across federation tiers:
 *   National → Regional → Local
 *
 * Detects override rejections, publication denials, inheritance conflicts,
 * and governance deadlocks. Read-only; never mutates production state.
 *
 * @module lib/governance-simulation/federation
 */

import type {
  GovernanceSimulationScenario,
  FederationSimulationResult,
} from './types';
import type { FederationTier } from '../governance-policy/types';

// ── Inheritance chain resolution ──────────────────────────────────────────────

/** Ordered federation tiers from most authoritative to least. */
const FEDERATION_TIER_ORDER: FederationTier[] = ['national', 'regional', 'local'];

function tierIndex(tier: FederationTier): number {
  return FEDERATION_TIER_ORDER.indexOf(tier);
}

/**
 * Resolve the full inheritance path from the scenario tier up to national.
 * E.g. local → ['local', 'regional', 'national']
 */
function resolveInheritancePath(fromTier: FederationTier): FederationTier[] {
  const idx = tierIndex(fromTier);
  return FEDERATION_TIER_ORDER.slice(0, idx + 1).reverse(); // local first, national last
}

// ── Override evaluation ───────────────────────────────────────────────────────

type OverrideOutcome = 'allowed' | 'rejected' | 'escalated' | 'deadlock';

function evaluateOverrideAttempt(
  scenario: GovernanceSimulationScenario,
): OverrideOutcome {
  if (scenario.stressType === 'policy-divergence') {
    // Local weakening attempt always rejected unless delegation is explicitly allowed
    if (scenario.governanceSensitivity === 'critical' || scenario.governanceSensitivity === 'high') {
      return 'rejected';
    }
    return 'escalated';
  }

  if (scenario.stressType === 'federation-conflict') {
    if (scenario.governanceSensitivity === 'critical') {
      return 'deadlock';
    }
    return 'escalated';
  }

  return 'allowed';
}

// ── Publication conflict resolution ──────────────────────────────────────────

function evaluatePublicationConflict(
  scenario: GovernanceSimulationScenario,
  inheritancePath: FederationTier[],
): {
  publicationBlocked: boolean;
  blockingTier: FederationTier | null;
  federationReviewRequired: boolean;
} {
  if (scenario.scope === 'publication' || scenario.stressType === 'publication-escalation') {
    // Publications from local tier require federation review if federationTier is local
    if (scenario.federationTier === 'local') {
      return {
        publicationBlocked: true,
        blockingTier: inheritancePath[inheritancePath.length - 1] ?? null, // national is last (most authoritative)
        federationReviewRequired: true,
      };
    }
  }

  if (scenario.stressType === 'federation-conflict') {
    return {
      publicationBlocked: scenario.governanceSensitivity === 'critical' || scenario.governanceSensitivity === 'high',
      blockingTier: 'national',
      federationReviewRequired: true,
    };
  }

  return {
    publicationBlocked: false,
    blockingTier: null,
    federationReviewRequired: false,
  };
}

// ── Deadlock detection ────────────────────────────────────────────────────────

function detectDeadlock(
  overrideOutcome: OverrideOutcome,
  scenario: GovernanceSimulationScenario,
): {
  deadlockDetected: boolean;
  deadlockTiers: FederationTier[];
  resolution: 'executive-escalation' | 'arbitration-required' | 'none';
} {
  if (overrideOutcome !== 'deadlock') {
    return { deadlockDetected: false, deadlockTiers: [], resolution: 'none' };
  }

  const deadlockTiers: FederationTier[] =
    scenario.federationTier === 'local'
      ? ['local', 'regional']
      : scenario.federationTier === 'regional'
        ? ['regional', 'national']
        : ['national'];

  const resolution =
    scenario.governanceSensitivity === 'critical'
      ? 'arbitration-required'
      : 'executive-escalation';

  return { deadlockDetected: true, deadlockTiers, resolution };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Simulate a federation conflict scenario.
 *
 * Returns a `FederationSimulationResult` describing the inheritance path,
 * detected conflicts, override outcomes, publication blocking, and
 * deadlock status.
 *
 * Never throws; errors are returned in `diagnostics`.
 */
export function simulateFederationConflict(
  scenario: GovernanceSimulationScenario,
): FederationSimulationResult {
  try {
    const tier: FederationTier = scenario.federationTier ?? 'local';
    const inheritancePath = resolveInheritancePath(tier);

    const overrideOutcome = evaluateOverrideAttempt(scenario);

    const { publicationBlocked, blockingTier, federationReviewRequired } =
      evaluatePublicationConflict(scenario, inheritancePath);

    const { deadlockDetected, deadlockTiers, resolution } = detectDeadlock(
      overrideOutcome,
      scenario,
    );

    const conflictDetected =
      overrideOutcome !== 'allowed' || deadlockDetected;

    const escalationRequired =
      scenario.escalationExpected ||
      overrideOutcome === 'escalated' ||
      overrideOutcome === 'deadlock' ||
      deadlockDetected;

    return {
      scenarioId: scenario.id,
      tier,
      inheritancePath,
      conflictDetected,
      overrideRejected: overrideOutcome === 'rejected',
      overrideOutcome,
      publicationBlocked,
      blockingTier,
      federationReviewRequired,
      escalationRequired,
      escalationPath: escalationRequired
        ? inheritancePath.map((t) => `governance.${t}`)
        : [],
      deadlockDetected,
      deadlockTiers,
      deadlockResolution: resolution,
      diagnostics: {
        scope: scenario.scope,
        stressType: scenario.stressType ?? null,
        sensitivity: scenario.governanceSensitivity,
        governanceMode: 'shadow' as const,
      },
    };
  } catch (err) {
    return {
      scenarioId: scenario.id,
      tier: scenario.federationTier ?? 'local',
      inheritancePath: [],
      conflictDetected: false,
      overrideRejected: false,
      overrideOutcome: 'allowed',
      publicationBlocked: false,
      blockingTier: null,
      federationReviewRequired: false,
      escalationRequired: false,
      escalationPath: [],
      deadlockDetected: false,
      deadlockTiers: [],
      deadlockResolution: 'none',
      diagnostics: { error: String(err), governanceMode: 'shadow' as const },
    };
  }
}
