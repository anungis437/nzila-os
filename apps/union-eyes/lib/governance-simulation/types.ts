/**
 * Core vocabulary for the governance-simulation layer.
 *
 * These types define the shared language for Wave 9:
 *   - Simulation scope and severity
 *   - Institutional stress scenarios
 *   - Governance incident classes
 *   - Readiness scores (shadow-mode, never exposed publicly)
 *   - Simulation results and replay contracts
 *
 * CRITICAL: this layer is READ-ONLY and SHADOW-ONLY.
 * No simulation mutates production runtime state.
 *
 * @module lib/governance-simulation/types
 */

import type { GovernanceSensitivity, FederationTier } from '../governance-policy/types';

// ── Simulation scope ──────────────────────────────────────────────────────────

/**
 * The operational domain being simulated.
 */
export type SimulationScope =
  | 'route'            // API route policy outcome
  | 'federation'       // federation inheritance / conflict path
  | 'publication'      // public-experience publication approval chain
  | 'governance'       // general governance policy resolution
  | 'ai-operation'     // AI governance escalation path
  | 'continuity'       // institutional continuity stress
  | 'incident';        // governance incident simulation

// ── Simulation severity ───────────────────────────────────────────────────────

/**
 * Severity of a simulation outcome.
 * Determines ledger retention class and procurement evidence weight.
 */
export type SimulationSeverity =
  | 'informational'       // no action required; nominal path confirmed
  | 'elevated'            // governance attention warranted
  | 'critical'            // escalation expected; board/exec awareness recommended
  | 'institutional-risk'; // continuity threat; continuity plan activation simulated

// ── Institutional stress ──────────────────────────────────────────────────────

/**
 * The type of institutional stress being applied in a simulation.
 * Covers the principal continuity risk categories for labour/association orgs.
 */
export type InstitutionalStressType =
  | 'leadership-turnover'       // key governance role vacated
  | 'federation-conflict'       // parent–child policy dispute
  | 'policy-divergence'         // local policy deviates from federation baseline
  | 'publication-escalation'    // publication blocked / escalated to exec
  | 'ai-governance-risk'        // AI action exceeds permitted risk tier
  | 'member-trust-event'        // member-facing governance failure
  | 'continuity-loss';          // catastrophic governance chain break

// ── Governance incident ───────────────────────────────────────────────────────

/**
 * Classes of governance incident that can be simulated.
 * Simulations only — no production execution.
 */
export type GovernanceIncident =
  | 'policy-breach'                 // operation executed outside policy boundary
  | 'unauthorized-publication'      // publication without required approval
  | 'federation-policy-divergence'  // local–federation conflict unresolved
  | 'audit-gap'                     // required audit event missing from chain
  | 'ai-escalation-failure';        // AI review required but not completed

// ── Scenario contract ─────────────────────────────────────────────────────────

/**
 * A governance simulation scenario — the input contract for the
 * simulation engine.
 *
 * Scenarios are deterministic and reproducible given the same inputs.
 */
export interface GovernanceSimulationScenario {
  /** Unique, stable scenario identifier. */
  id: string;

  /** Human-readable description. */
  description: string;

  /** Operational domain being simulated. */
  scope: SimulationScope;

  /** Institutional stress type (if applicable). */
  stressType?: InstitutionalStressType;

  /** Federation tier context for federation-scoped scenarios. */
  federationTier?: FederationTier;

  /** Governance sensitivity of the simulated operation. */
  governanceSensitivity: GovernanceSensitivity;

  /**
   * Explicit assumptions that must hold for the simulation to be valid.
   * Surfaced in procurement evidence reports.
   */
  assumptions: string[];

  /**
   * Policy contract IDs active in this simulation.
   * Must reference contracts registered in the governance-policy registry.
   */
  simulatedPolicies: string[];

  /**
   * Declared expected outcomes.
   * The engine validates actual outcomes against these.
   */
  expectedOutcomes: string[];

  /** Whether this scenario requires evidence generation. */
  evidenceRequired: boolean;

  /** Whether an escalation is expected as part of the nominal path. */
  escalationExpected: boolean;

  /** Optional governance incident class this scenario models. */
  incidentClass?: GovernanceIncident;
}

// ── Simulation result ─────────────────────────────────────────────────────────

/**
 * The result of executing a governance simulation scenario.
 */
export interface GovernanceSimulationResult {
  /** The scenario that was executed. */
  scenarioId: string;

  /** Simulation run timestamp (ISO 8601). */
  simulatedAt: string;

  /** Overall severity of the simulated outcome. */
  severity: SimulationSeverity;

  /**
   * Whether the actual outcomes match all expected outcomes declared
   * in the scenario contract.
   */
  outcomesMatched: boolean;

  /**
   * Outcomes produced by the simulation engine.
   * Format: stable outcome identifiers (e.g. 'escalation.triggered').
   */
  actualOutcomes: string[];

  /**
   * Expected outcomes that were NOT produced.
   * Empty array = full match.
   */
  unmatchedExpected: string[];

  /**
   * Escalation chain produced by the simulation (if any).
   * e.g. ['local', 'regional', 'national']
   */
  escalationChain: string[];

  /**
   * Whether the simulation detected a continuity gap.
   */
  continuityGapDetected: boolean;

  /**
   * Whether the simulation detected a federation conflict.
   */
  federationConflictDetected: boolean;

  /**
   * Governance mode active during simulation.
   * Always 'shadow' in Wave 9.
   */
  governanceMode: 'shadow';

  /** Governance correlation ID linking this result to the observability ledger. */
  correlationId?: string;

  /** Structured diagnostic payload. */
  diagnostics: Record<string, unknown>;
}

// ── Replay contract ───────────────────────────────────────────────────────────

/**
 * Input contract for replaying a previous simulation under new policy conditions.
 * Allows policy evolution impact to be assessed without touching production.
 */
export interface SimulationReplayRequest {
  /** Original scenario ID to replay. */
  scenarioId: string;

  /** Optional policy overrides to apply during replay. */
  policyOverrides?: Record<string, unknown>;

  /** Optional federation tier override. */
  federationTierOverride?: FederationTier;

  /** Optional governance sensitivity override. */
  sensitivityOverride?: GovernanceSensitivity;

  /** Label for this replay run (e.g. 'post-policy-tightening'). */
  replayLabel: string;
}

/**
 * Result of a simulation replay — includes comparison against the
 * original simulation result.
 */
export interface SimulationReplayResult {
  request: SimulationReplayRequest;
  original: GovernanceSimulationResult;
  replayed: GovernanceSimulationResult;

  /**
   * Whether the replayed outcome materially diverges from the original.
   * True if severity, escalation chain, or outcome match changed.
   */
  divergenceDetected: boolean;

  /** Specific dimensions where divergence was detected. */
  divergenceDimensions: string[];
}

// ── Federation simulation result ─────────────────────────────────────────────

type OverrideOutcome = 'allowed' | 'rejected' | 'escalated' | 'deadlock';

export interface FederationSimulationResult {
  scenarioId: string;
  tier: FederationTier;
  inheritancePath: FederationTier[];
  conflictDetected: boolean;
  overrideRejected: boolean;
  overrideOutcome: OverrideOutcome;
  publicationBlocked: boolean;
  blockingTier: FederationTier | null;
  federationReviewRequired: boolean;
  escalationRequired: boolean;
  escalationPath: string[];
  deadlockDetected: boolean;
  deadlockTiers: FederationTier[];
  deadlockResolution: 'executive-escalation' | 'arbitration-required' | 'none';
  diagnostics: Record<string, unknown>;
}

// ── Continuity simulation result ──────────────────────────────────────────────

export interface ContinuitySimulationResult {
  scenarioId: string;
  stressType: InstitutionalStressType;
  continuityGapDetected: boolean;
  governanceOrphanDetected: boolean;
  auditChainIntact: boolean;
  leadershipGap: boolean;
  policyOwnershipGap: boolean;
  escalationRequired: boolean;
  affectedRoles: string[];
  remediationSteps: string[];
  diagnostics: Record<string, unknown>;
}

// ── AI simulation result ──────────────────────────────────────────────────────

export interface AISimulationResult {
  scenarioId: string;
  riskTier: import('../governance-policy/types').AIActionRisk;
  humanReviewRequired: boolean;
  escalationTriggered: boolean;
  federationRestrictionApplied: boolean;
  operationBlocked: boolean;
  riskReclassified: boolean;
  auditEmitted: boolean;
  diagnostics: Record<string, unknown>;
}

// ── Readiness scores ──────────────────────────────────────────────────────────

/**
 * Composite institutional readiness score.
 * Shadow-mode only — never exposed publicly in Wave 9.
 * Generated from simulation ledger aggregation.
 */
export interface InstitutionalReadinessScore {
  /** Overall score 0–100 (shadow classification only). */
  overall: number;

  /** Governance continuity dimension. */
  continuity: GovernanceContinuityScore;

  /** Federation stability dimension. */
  federation: FederationStabilityScore;

  /** Publication governance dimension. */
  publication: PublicationGovernanceScore;

  /** AI accountability dimension. */
  aiAccountability: AIAccountabilityScore;

  /** ISO 8601 timestamp of score generation. */
  scoredAt: string;

  /** Number of simulations contributing to this score. */
  simulationCount: number;
}

export interface GovernanceContinuityScore {
  score: number;
  continuityGapsDetected: number;
  leadershipVulnerabilities: number;
  auditChainIntegrity: boolean;
}

export interface FederationStabilityScore {
  score: number;
  conflictsSimulated: number;
  conflictsResolved: number;
  inheritanceViolations: number;
}

export interface PublicationGovernanceScore {
  score: number;
  escalationsRequired: number;
  unauthorizedAttempts: number;
  approvalCoverageComplete: boolean;
}

export interface AIAccountabilityScore {
  score: number;
  highRiskOperationsSimulated: number;
  humanReviewTriggered: number;
  escalationsResolved: number;
}
