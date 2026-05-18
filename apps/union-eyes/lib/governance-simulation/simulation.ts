/**
 * Core governance simulation engine.
 *
 * Executes and replays governance simulation scenarios.
 * This engine is:
 *   - READ-ONLY: never mutates production state
 *   - SHADOW-ONLY: governance mode is always 'shadow'
 *   - DETERMINISTIC: given the same scenario + policies, produces the same result
 *   - FAIL-SAFE: never throws; errors are captured as diagnostics
 *
 * @module lib/governance-simulation/simulation
 */

import type {
  GovernanceSimulationScenario,
  GovernanceSimulationResult,
  SimulationReplayRequest,
  SimulationReplayResult,
  SimulationSeverity,
} from './types';
import { getScenario } from './scenarios';
import { recordSimulationResult } from './ledger';
import { createCorrelationContext } from '../governance-observability/correlation';
import { getAllContracts } from '../governance-policy/registry';

// ── Simulation ID generation ──────────────────────────────────────────────────

function generateSimId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `gsim_${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `gsim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ── Severity derivation ───────────────────────────────────────────────────────

function deriveSeverity(
  scenario: GovernanceSimulationScenario,
  outcomes: string[],
  continuityGap: boolean,
  federationConflict: boolean,
): SimulationSeverity {
  if (scenario.governanceSensitivity === 'critical' || continuityGap) {
    return 'institutional-risk';
  }
  if (
    federationConflict ||
    outcomes.includes('governance.deadlock.detected') ||
    outcomes.includes('policy.breach.detected')
  ) {
    return 'critical';
  }
  if (
    scenario.governanceSensitivity === 'high' ||
    outcomes.includes('escalation.triggered') ||
    outcomes.includes('human-review.triggered')
  ) {
    return 'elevated';
  }
  return 'informational';
}

// ── Outcome resolution ────────────────────────────────────────────────────────

/**
 * Resolve the set of actual governance outcomes for a scenario.
 *
 * Outcomes are derived from:
 *   1. The scenario's stress type and scope
 *   2. The simulated policies (checked against the registry)
 *   3. Explicit scenario flags (escalationExpected, evidenceRequired)
 *
 * This is a deterministic rule engine — no AI, no randomness.
 */
function resolveOutcomes(
  scenario: GovernanceSimulationScenario,
  policyOverrides?: Record<string, unknown>,
): {
  outcomes: string[];
  escalationChain: string[];
  continuityGapDetected: boolean;
  federationConflictDetected: boolean;
  diagnostics: Record<string, unknown>;
} {
  const outcomes: string[] = [];
  const escalationChain: string[] = [];
  let continuityGapDetected = false;
  let federationConflictDetected = false;
  const diagnostics: Record<string, unknown> = {};

  // Registry check: verify all simulated policies exist
  const registeredContracts = getAllContracts();
  const registeredIds = new Set(registeredContracts.map((c) => c.id));
  const missingPolicies = scenario.simulatedPolicies.filter(
    (p) => !registeredIds.has(p),
  );
  if (missingPolicies.length > 0) {
    diagnostics['missingPolicies'] = missingPolicies;
    diagnostics['warning'] = 'Some simulated policies are not in the registry; scenario runs with degraded fidelity.';
  }

  // Scope-based outcome resolution
  switch (scenario.scope) {
    case 'federation': {
      federationConflictDetected = scenario.stressType === 'federation-conflict' ||
        scenario.stressType === 'policy-divergence';

      if (scenario.stressType === 'policy-divergence') {
        outcomes.push('override.rejected');
        outcomes.push('federation.conflict.recorded');
      }
      if (scenario.stressType === 'federation-conflict') {
        outcomes.push('inheritance.cascade.triggered');
        outcomes.push('federation.conflict.recorded');
      }
      if (federationConflictDetected && scenario.governanceSensitivity === 'critical') {
        outcomes.push('governance.deadlock.detected');
        outcomes.push('executive-approval.required');
        outcomes.push('publication.blocked');
      }
      if (scenario.federationTier === 'local') {
        outcomes.push('local.publication.blocked');
        outcomes.push('federation-review.required');
      }
      break;
    }

    case 'continuity': {
      continuityGapDetected = true;
      outcomes.push('continuity.gap.detected');

      switch (scenario.stressType) {
        case 'leadership-turnover': {
          outcomes.push('governance.orphan.identified');
          outcomes.push('succession.alert.generated');
          if (scenario.governanceSensitivity === 'critical') {
            outcomes.push('approval.authority.gap');
            outcomes.push('publication.blocked');
          }
          break;
        }
        case 'continuity-loss': {
          if (scenario.incidentClass === 'audit-gap') {
            outcomes.push('audit.gap.detected');
            outcomes.push('governance.chain.incomplete');
            outcomes.push('legal-review.required');
          } else {
            outcomes.push('policy.orphan.detected');
            outcomes.push('governance.escalation.triggered');
          }
          break;
        }
      }
      break;
    }

    case 'publication': {
      outcomes.push('publication.blocked');
      outcomes.push('approval.required');
      outcomes.push('audit.emitted');

      if (scenario.stressType === 'publication-escalation') {
        if (scenario.federationTier === 'local') {
          federationConflictDetected = true;
          outcomes.push('federation-review.required');
          outcomes.push('federation.conflict.recorded');
        }
      }
      break;
    }

    case 'ai-operation': {
      outcomes.push('audit.emitted');

      if (scenario.stressType === 'ai-governance-risk') {
        outcomes.push('human-review.triggered');
        outcomes.push('ai-operation.escalated');

        if (scenario.incidentClass === 'ai-escalation-failure') {
          outcomes.push('risk.reclassified');
        }
      }

      if (scenario.stressType === 'federation-conflict') {
        outcomes.push('ai-operation.blocked');
        outcomes.push('federation.restriction.applied');
      }
      break;
    }

    case 'incident': {
      outcomes.push('audit.emitted');
      outcomes.push('legal-review.required');

      if (scenario.incidentClass === 'policy-breach') {
        outcomes.push('policy.breach.detected');
      }
      if (scenario.incidentClass === 'unauthorized-publication') {
        outcomes.push('publication.blocked');
      }
      if (scenario.incidentClass === 'audit-gap') {
        outcomes.push('governance.chain.incomplete');
      }
      break;
    }

    case 'governance':
    case 'route': {
      outcomes.push('policy.evaluated');
      if (scenario.governanceSensitivity === 'critical' || scenario.governanceSensitivity === 'high') {
        outcomes.push('audit.emitted');
      }
      break;
    }
  }

  // Universal rules
  if (scenario.escalationExpected) {
    outcomes.push('escalation.triggered');

    // Build escalation chain based on federation tier
    if (scenario.federationTier === 'local') {
      escalationChain.push('local', 'regional', 'national');
    } else if (scenario.federationTier === 'regional') {
      escalationChain.push('regional', 'national');
    } else {
      escalationChain.push('governance');
    }
  }

  if (scenario.evidenceRequired) {
    outcomes.push('evidence.generated');
  }

  // Apply policy overrides to diagnostics (shadow-mode: overrides are noted, not enforced)
  if (policyOverrides && Object.keys(policyOverrides).length > 0) {
    diagnostics['policyOverrides'] = policyOverrides;
    diagnostics['overrideNote'] = 'Policy overrides applied in shadow mode only; production behavior unchanged.';
  }

  diagnostics['scope'] = scenario.scope;
  diagnostics['stressType'] = scenario.stressType ?? null;
  diagnostics['sensitivity'] = scenario.governanceSensitivity;

  return {
    outcomes: [...new Set(outcomes)], // deduplicate
    escalationChain,
    continuityGapDetected,
    federationConflictDetected,
    diagnostics,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a governance simulation scenario by ID.
 *
 * Returns a `GovernanceSimulationResult` and records it to the simulation
 * ledger. Never throws — errors are returned in `diagnostics`.
 */
export function runScenario(
  scenarioId: string,
  opts?: { policyOverrides?: Record<string, unknown> },
): GovernanceSimulationResult {
  try {
    const scenario = getScenario(scenarioId);

    if (!scenario) {
      const result: GovernanceSimulationResult = {
        scenarioId,
        simulatedAt: new Date().toISOString(),
        severity: 'informational',
        outcomesMatched: false,
        actualOutcomes: [],
        unmatchedExpected: [],
        escalationChain: [],
        continuityGapDetected: false,
        federationConflictDetected: false,
        governanceMode: 'shadow',
        diagnostics: { error: `Scenario '${scenarioId}' not found in catalog.` },
      };
      recordSimulationResult(result);
      return result;
    }

    const {
      outcomes,
      escalationChain,
      continuityGapDetected,
      federationConflictDetected,
      diagnostics,
    } = resolveOutcomes(scenario, opts?.policyOverrides);

    const outcomesMatched = scenario.expectedOutcomes.every((e) =>
      outcomes.includes(e),
    );
    const unmatchedExpected = scenario.expectedOutcomes.filter(
      (e) => !outcomes.includes(e),
    );

    const severity = deriveSeverity(
      scenario,
      outcomes,
      continuityGapDetected,
      federationConflictDetected,
    );

    const correlationCtx = createCorrelationContext();

    const result: GovernanceSimulationResult = {
      scenarioId,
      simulatedAt: new Date().toISOString(),
      severity,
      outcomesMatched,
      actualOutcomes: outcomes,
      unmatchedExpected,
      escalationChain,
      continuityGapDetected,
      federationConflictDetected,
      governanceMode: 'shadow',
      correlationId: correlationCtx.governanceCorrelationId,
      diagnostics,
    };

    recordSimulationResult(result);
    return result;
  } catch (err) {
    const result: GovernanceSimulationResult = {
      scenarioId,
      simulatedAt: new Date().toISOString(),
      severity: 'informational',
      outcomesMatched: false,
      actualOutcomes: [],
      unmatchedExpected: [],
      escalationChain: [],
      continuityGapDetected: false,
      federationConflictDetected: false,
      governanceMode: 'shadow',
      diagnostics: { error: String(err) },
    };
    return result;
  }
}

/**
 * Run all scenarios in the catalog and return results.
 */
export function runAllScenarios(): GovernanceSimulationResult[] {
  const { getAllScenarios } = require('./scenarios') as typeof import('./scenarios');
  return getAllScenarios().map((s) => runScenario(s.id));
}

/**
 * Replay a previous scenario under new policy conditions.
 * Compares the original result against the replayed result.
 */
export function replayScenario(
  request: SimulationReplayRequest,
): SimulationReplayResult {
  try {
    const scenario = getScenario(request.scenarioId);

    if (!scenario) {
      const empty: GovernanceSimulationResult = {
        scenarioId: request.scenarioId,
        simulatedAt: new Date().toISOString(),
        severity: 'informational',
        outcomesMatched: false,
        actualOutcomes: [],
        unmatchedExpected: [],
        escalationChain: [],
        continuityGapDetected: false,
        federationConflictDetected: false,
        governanceMode: 'shadow',
        diagnostics: { error: `Scenario '${request.scenarioId}' not found.` },
      };
      return {
        request,
        original: empty,
        replayed: empty,
        divergenceDetected: false,
        divergenceDimensions: [],
      };
    }

    // Run original (no overrides)
    const original = runScenario(request.scenarioId);

    // Build overridden scenario for replay
    const overriddenScenario: GovernanceSimulationScenario = {
      ...scenario,
      ...(request.federationTierOverride
        ? { federationTier: request.federationTierOverride }
        : {}),
      ...(request.sensitivityOverride
        ? { governanceSensitivity: request.sensitivityOverride }
        : {}),
    };

    // Temporarily register overridden scenario for replay
    const replayId = `${request.scenarioId}._replay_${Date.now()}`;
    const { registerScenario } = require('./scenarios') as typeof import('./scenarios');
    registerScenario({ ...overriddenScenario, id: replayId });

    const replayed = runScenario(replayId, {
      policyOverrides: request.policyOverrides,
    });

    // Detect divergence
    const divergenceDimensions: string[] = [];
    if (original.severity !== replayed.severity) {
      divergenceDimensions.push('severity');
    }
    if (
      JSON.stringify(original.escalationChain) !==
      JSON.stringify(replayed.escalationChain)
    ) {
      divergenceDimensions.push('escalationChain');
    }
    if (original.outcomesMatched !== replayed.outcomesMatched) {
      divergenceDimensions.push('outcomesMatched');
    }
    if (original.continuityGapDetected !== replayed.continuityGapDetected) {
      divergenceDimensions.push('continuityGapDetected');
    }
    if (original.federationConflictDetected !== replayed.federationConflictDetected) {
      divergenceDimensions.push('federationConflictDetected');
    }

    return {
      request,
      original,
      replayed,
      divergenceDetected: divergenceDimensions.length > 0,
      divergenceDimensions,
    };
  } catch (err) {
    const empty: GovernanceSimulationResult = {
      scenarioId: request.scenarioId,
      simulatedAt: new Date().toISOString(),
      severity: 'informational',
      outcomesMatched: false,
      actualOutcomes: [],
      unmatchedExpected: [],
      escalationChain: [],
      continuityGapDetected: false,
      federationConflictDetected: false,
      governanceMode: 'shadow',
      diagnostics: { error: String(err) },
    };
    return {
      request,
      original: empty,
      replayed: empty,
      divergenceDetected: false,
      divergenceDimensions: [],
    };
  }
}
