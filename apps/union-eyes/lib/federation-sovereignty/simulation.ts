/**
 * Cross-federation simulation engine and sovereignty replay engine.
 *
 * Provides:
 *   - cross-federation simulation scenario runner
 *   - built-in canonical simulation scenarios
 *   - sovereignty replay (deterministic re-simulation against new policies)
 *
 * Shadow-mode only. Never executes against production runtime.
 *
 * @module lib/federation-sovereignty/simulation
 */

import type {
  CrossFederationSimulationScenario,
  CrossFederationSimulationResult,
  SovereignGovernanceContract,
  SovereigntyConflictType,
  SovereigntyTier,
  ConflictResolutionPath,
} from './types';
import {
  detectPolicyDivergence,
  detectPublicationDispute,
  detectAIAutonomyConflict,
  detectEscalationDeadlock,
} from './conflicts';
import { modelContinuitySharing, modelJointPublication } from './coordination';
import { evaluateDelegationChain } from './delegation';

// ── Scenario registry ─────────────────────────────────────────────────────────

// ga-check:exempt — in-process runtime registry, not primary persistence
const _scenarios = new Map<string, CrossFederationSimulationScenario>();

export function registerSimulationScenario(
  scenario: CrossFederationSimulationScenario,
): void {
  _scenarios.set(scenario.id, scenario);
}

export function getSimulationScenario(
  id: string,
): CrossFederationSimulationScenario | undefined {
  return _scenarios.get(id);
}

export function getAllSimulationScenarios(): CrossFederationSimulationScenario[] {
  return [..._scenarios.values()];
}

export function _resetSimulationRegistry(): void {
  _scenarios.clear();
}

// ── Canonical built-in scenarios ──────────────────────────────────────────────

export const BUILT_IN_SCENARIOS: CrossFederationSimulationScenario[] = [
  {
    id: 'national-policy-tightening',
    description:
      'National tightens policy; regional refuses inheritance; local publication request conflicts.',
    participatingTiers: ['national', 'regional', 'local'],
    eventType: 'joint-publication',
    conflictTypes: ['policy-divergence', 'publication-dispute'],
    assumptions: [
      'National has authority to tighten policies',
      'Regional has federation-aligned mode',
      'Local holds delegated publication authority',
    ],
    expectedOutcomes: [
      'policy-divergence-detected',
      'escalation-triggered',
      'publication-requires-federation-approval',
    ],
    escalationExpected: true,
    evidenceRequired: true,
  },
  {
    id: 'steward-turnover-continuity-loss',
    description: 'Steward turnover at local level causes continuity authority gap.',
    participatingTiers: ['local', 'regional'],
    eventType: 'continuity-sharing-request',
    conflictTypes: ['continuity-jurisdiction'],
    assumptions: [
      'Local steward holds sole continuity-management authority',
      'No succession plan registered',
    ],
    expectedOutcomes: [
      'continuity-gap-detected',
      'regional-escalation-required',
      'continuity-sharing-evidence-generated',
    ],
    escalationExpected: true,
    evidenceRequired: true,
  },
  {
    id: 'ai-governance-federation-conflict',
    description: 'Regional tightens AI governance; local requests AI publication override.',
    participatingTiers: ['regional', 'local'],
    eventType: 'authority-request',
    conflictTypes: ['ai-autonomy-conflict'],
    assumptions: [
      'Regional has restricted AI operations',
      'Local is federation-aligned',
    ],
    expectedOutcomes: [
      'ai-autonomy-conflict-detected',
      'local-override-rejected',
      'executive-escalation-required',
    ],
    escalationExpected: true,
    evidenceRequired: true,
  },
  {
    id: 'coalition-publication-governance',
    description: 'Coalition of locals attempt joint publication across restricted federation.',
    participatingTiers: ['local', 'coalition'],
    eventType: 'joint-publication',
    conflictTypes: ['publication-dispute', 'policy-divergence'],
    assumptions: [
      'One local unit has publication authority',
      'One local unit is restricted',
    ],
    expectedOutcomes: [
      'publication-dispute-detected',
      'federation-mediation-required',
      'evidence-ledger-entry-created',
    ],
    escalationExpected: false,
    evidenceRequired: true,
  },
  {
    id: 'audit-visibility-escalation-deadlock',
    description: 'Two national units dispute audit visibility scope — no parent tier available.',
    participatingTiers: ['national', 'national'],
    eventType: 'audit-summary-share',
    conflictTypes: ['audit-visibility-disagreement', 'escalation-deadlock'],
    assumptions: ['Both units are national tier', 'No higher federation tier exists'],
    expectedOutcomes: [
      'escalation-deadlock-detected',
      'arbitration-required',
    ],
    escalationExpected: true,
    evidenceRequired: true,
  },
];

// Register built-ins on module load
for (const scenario of BUILT_IN_SCENARIOS) {
  registerSimulationScenario(scenario);
}

// ── Simulation runner ─────────────────────────────────────────────────────────

/**
 * Execute a cross-federation simulation scenario against a set of contracts.
 *
 * Returns a fully traceable simulation result. Shadow-mode only.
 */
export function runCrossFederationSimulation(
  scenario: CrossFederationSimulationScenario,
  contracts: SovereignGovernanceContract[],
  correlationId: string,
): CrossFederationSimulationResult {
  const conflictsDetected: SovereigntyConflictType[] = [];
  const resolutionPaths: ConflictResolutionPath[] = [];
  const escalationChain: SovereigntyTier[] = [];
  const actualOutcomes: string[] = [];

  if (contracts.length >= 2) {
    const [a, b] = [contracts[0]!, contracts[1]!];

    // Policy divergence check
    if (scenario.conflictTypes.includes('policy-divergence')) {
      const result = detectPolicyDivergence(a, b);
      if (result.conflictDetected) {
        conflictsDetected.push('policy-divergence');
        resolutionPaths.push(result.resolutionPath);
        actualOutcomes.push('policy-divergence-detected');
        if (result.escalationRequired) {
          escalationChain.push(a.sovereigntyTier, b.sovereigntyTier);
          actualOutcomes.push('escalation-triggered');
        }
      }
    }

    // Publication dispute check
    if (scenario.conflictTypes.includes('publication-dispute')) {
      const result = detectPublicationDispute(a, b);
      if (result.conflictDetected) {
        conflictsDetected.push('publication-dispute');
        resolutionPaths.push(result.resolutionPath);
        actualOutcomes.push('publication-requires-federation-approval');
        if (!resolutionPaths.includes('federation-mediation')) {
          resolutionPaths.push('federation-mediation');
        }
        actualOutcomes.push('federation-mediation-required');
      }
    }
  }

  if (contracts.length >= 1) {
    const contract = contracts[0]!;

    // AI autonomy conflict check
    if (scenario.conflictTypes.includes('ai-autonomy-conflict')) {
      const result = detectAIAutonomyConflict(contract, 'ai.publication');
      if (result.conflictDetected) {
        conflictsDetected.push('ai-autonomy-conflict');
        resolutionPaths.push(result.resolutionPath);
        actualOutcomes.push('ai-autonomy-conflict-detected');
        actualOutcomes.push('local-override-rejected');
        if (result.escalationRequired) {
          actualOutcomes.push('executive-escalation-required');
        }
      }
    }

    // Continuity jurisdiction check
    if (scenario.conflictTypes.includes('continuity-jurisdiction')) {
      const hasContinuity = contract.delegatedAuthorities.includes('continuity-management');
      if (!hasContinuity) {
        conflictsDetected.push('continuity-jurisdiction');
        actualOutcomes.push('continuity-gap-detected');
        actualOutcomes.push('regional-escalation-required');
        actualOutcomes.push('continuity-sharing-evidence-generated');
        escalationChain.push('local', 'regional');
      }
    }
  }

  // Escalation deadlock check
  if (
    scenario.conflictTypes.includes('escalation-deadlock') &&
    scenario.participatingTiers.length >= 2
  ) {
    const [ta, tb] = scenario.participatingTiers;
    const result = detectEscalationDeadlock(
      ta!,
      tb!,
      scenario.conflictTypes[0] ?? 'policy-divergence',
    );
    if (result.conflictDetected) {
      conflictsDetected.push('escalation-deadlock');
      resolutionPaths.push('arbitration-required');
      actualOutcomes.push('escalation-deadlock-detected');
      actualOutcomes.push('arbitration-required');
    }
  }

  const unmatchedExpected = scenario.expectedOutcomes.filter(
    (e) => !actualOutcomes.includes(e),
  );

  return {
    scenarioId: scenario.id,
    participatingTiers: scenario.participatingTiers,
    conflictsDetected,
    resolutionPaths: [...new Set(resolutionPaths)],
    escalationChain: [...new Set(escalationChain)],
    outcomesMatched: unmatchedExpected.length === 0,
    actualOutcomes,
    unmatchedExpected,
    governanceMode: 'shadow',
    correlationId,
    diagnostics: {
      contractCount: contracts.length,
      scenarioId: scenario.id,
    },
  };
}

// ── Sovereignty replay engine ─────────────────────────────────────────────────

export interface SovereigntyReplayInput {
  scenarioId: string;
  originalContracts: SovereignGovernanceContract[];
  updatedContracts: SovereignGovernanceContract[];
  correlationId: string;
}

export interface SovereigntyReplayResult {
  scenarioId: string;
  originalResult: CrossFederationSimulationResult;
  replayedResult: CrossFederationSimulationResult;
  policiesChanged: boolean;
  outcomeDrift: {
    newConflicts: SovereigntyConflictType[];
    resolvedConflicts: SovereigntyConflictType[];
    newOutcomes: string[];
    removedOutcomes: string[];
  };
  governanceMode: 'shadow';
}

/**
 * Replay a governance scenario against updated contracts.
 *
 * Compares original vs. replayed results to surface outcome drift
 * caused by policy changes.
 */
export function replaySovereigntyScenario(
  input: SovereigntyReplayInput,
): SovereigntyReplayResult {
  const scenario = getSimulationScenario(input.scenarioId);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${input.scenarioId}`);
  }

  const originalResult = runCrossFederationSimulation(
    scenario,
    input.originalContracts,
    `${input.correlationId}:original`,
  );

  const replayedResult = runCrossFederationSimulation(
    scenario,
    input.updatedContracts,
    `${input.correlationId}:replayed`,
  );

  const newConflicts = replayedResult.conflictsDetected.filter(
    (c) => !originalResult.conflictsDetected.includes(c),
  );
  const resolvedConflicts = originalResult.conflictsDetected.filter(
    (c) => !replayedResult.conflictsDetected.includes(c),
  );
  const newOutcomes = replayedResult.actualOutcomes.filter(
    (o) => !originalResult.actualOutcomes.includes(o),
  );
  const removedOutcomes = originalResult.actualOutcomes.filter(
    (o) => !replayedResult.actualOutcomes.includes(o),
  );

  return {
    scenarioId: input.scenarioId,
    originalResult,
    replayedResult,
    policiesChanged:
      JSON.stringify(input.originalContracts) !==
      JSON.stringify(input.updatedContracts),
    outcomeDrift: {
      newConflicts,
      resolvedConflicts,
      newOutcomes,
      removedOutcomes,
    },
    governanceMode: 'shadow',
  };
}
