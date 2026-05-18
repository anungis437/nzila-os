/**
 * Core vocabulary for the sovereign federation execution layer.
 *
 * Defines the institutional sovereignty semantics used across:
 *   - autonomy engine      (autonomy.ts)
 *   - delegation engine    (delegation.ts)
 *   - inheritance engine   (inheritance.ts)
 *   - coordination layer   (coordination.ts)
 *   - conflict resolver    (conflicts.ts)
 *   - sovereignty ledger   (ledger.ts)
 *   - simulation layer     (simulation.ts)
 *   - readiness scoring    (scoring.ts)
 *
 * All types are shadow-mode oriented. No production runtime is mutated.
 *
 * @module lib/federation-sovereignty/types
 */

// ── Tiers ─────────────────────────────────────────────────────────────────────

/**
 * Extended sovereignty tier set — superset of FederationTier from Wave 7.
 * Affiliate = cross-organisation partner unit; Coalition = multi-union grouping.
 */
export type SovereigntyTier =
  | 'national'
  | 'regional'
  | 'local'
  | 'affiliate'
  | 'coalition';

// ── Modes ─────────────────────────────────────────────────────────────────────

/**
 * Operational sovereignty mode for an institutional unit.
 *
 * - fully-autonomous:      operates independently; inherits baseline only
 * - federation-aligned:    operates within federation policies; standard inheritance
 * - restricted:            constrained by parent; reduced autonomy
 * - oversight-required:    active federation oversight; all escalations surface up
 */
export type SovereigntyMode =
  | 'fully-autonomous'
  | 'federation-aligned'
  | 'restricted'
  | 'oversight-required';

// ── Authority ─────────────────────────────────────────────────────────────────

/**
 * A discrete authority domain that can be delegated across federation tiers.
 */
export type DelegatedAuthority =
  | 'publication'
  | 'policy-enforcement'
  | 'member-governance'
  | 'ai-operations'
  | 'audit-visibility'
  | 'continuity-management';

// ── Contracts ─────────────────────────────────────────────────────────────────

/**
 * Sovereign governance contract for an institutional unit.
 * Defines its tier, sovereignty mode, delegated authorities, and federation
 * inheritance constraints.
 */
export interface SovereignGovernanceContract {
  /** Unique federation/org identifier. */
  federationId: string;

  /** Institutional tier in the federation hierarchy. */
  sovereigntyTier: SovereigntyTier;

  /** Current operational sovereignty mode. */
  sovereigntyMode: SovereigntyMode;

  /** Authority domains delegated to this unit. */
  delegatedAuthorities: DelegatedAuthority[];

  /** Policy IDs inherited from parent federation tiers. */
  inheritedPolicies: string[];

  /** Policy IDs this unit may NOT override (hard restrictions). */
  overrideRestrictions: string[];

  /** Conditions under which escalation to parent tier is required. */
  escalationRequirements: string[];

  /** Continuity requirements imposed by federation membership. */
  continuityRequirements: string[];

  /** Maximum audit visibility scope this unit exposes to parent tiers. */
  auditVisibility: 'local' | 'regional' | 'national' | 'federated';
}

// ── Delegation ────────────────────────────────────────────────────────────────

/**
 * A single delegation grant from a granting tier to a receiving unit.
 */
export interface DelegationGrant {
  id: string;
  grantingTier: SovereigntyTier;
  receivingFederationId: string;
  authority: DelegatedAuthority;
  /** Conditions under which this grant can be exercised. */
  conditions: string[];
  /** Whether the receiving unit may sub-delegate further. */
  subDelegationAllowed: boolean;
  /** Whether the grant may be revoked unilaterally by the grantor. */
  revocable: boolean;
}

/**
 * Result of evaluating a delegation chain.
 */
export interface DelegationChainResult {
  federationId: string;
  authority: DelegatedAuthority;
  granted: boolean;
  grantPath: SovereigntyTier[];
  conditions: string[];
  subDelegationAllowed: boolean;
  conflicts: string[];
  diagnostics: Record<string, unknown>;
}

// ── Conflicts ─────────────────────────────────────────────────────────────────

/**
 * Category of sovereignty conflict.
 */
export type SovereigntyConflictType =
  | 'policy-divergence'
  | 'authority-override'
  | 'publication-dispute'
  | 'ai-autonomy-conflict'
  | 'audit-visibility-disagreement'
  | 'continuity-jurisdiction'
  | 'escalation-deadlock';

/**
 * Resolution pathway for a sovereignty conflict.
 */
export type ConflictResolutionPath =
  | 'federation-mediation'
  | 'executive-escalation'
  | 'arbitration-required'
  | 'local-withdrawal'
  | 'national-override'
  | 'none';

/**
 * Result of resolving (or classifying) a sovereignty conflict.
 */
export interface SovereigntyConflictResult {
  conflictId: string;
  conflictType: SovereigntyConflictType;
  involvedTiers: SovereigntyTier[];
  conflictDetected: boolean;
  resolutionPath: ConflictResolutionPath;
  escalationRequired: boolean;
  autoResolvable: boolean;
  evidenceRequired: boolean;
  diagnostics: Record<string, unknown>;
}

// ── Coordination ──────────────────────────────────────────────────────────────

/**
 * Cross-federation coordination event type.
 */
export type CoordinationEventType =
  | 'continuity-sharing-request'
  | 'joint-publication'
  | 'escalation-transfer'
  | 'authority-request'
  | 'coalition-governance'
  | 'audit-summary-share';

/**
 * A coordination event between federation units.
 */
export interface FederationCoordinationEvent {
  eventId: string;
  eventType: CoordinationEventType;
  sourceFederationId: string;
  targetFederationId: string;
  requiresApproval: boolean;
  evidenceRequired: boolean;
  escalationPath: SovereigntyTier[];
  diagnostics: Record<string, unknown>;
}

// ── AI Sovereignty ────────────────────────────────────────────────────────────

/**
 * AI autonomy boundary applicable within a federation unit.
 */
export interface AIAutonomyBoundary {
  federationId: string;
  sovereigntyTier: SovereigntyTier;
  /** Maximum AI risk tier permitted without human review in this unit. */
  maxPermittedRisk: 'assistive' | 'advisory' | 'sensitive';
  /** AI operation types explicitly restricted at this sovereignty level. */
  federatedRestrictions: string[];
  humanReviewJurisdiction: 'local' | 'regional' | 'national';
  /** Whether local overrides of federation AI restrictions are permitted. */
  localOverrideAllowed: boolean;
}

// ── Audit Visibility ──────────────────────────────────────────────────────────

/**
 * Scoped audit visibility policy for a federation unit.
 */
export interface AuditVisibilityPolicy {
  federationId: string;
  sovereigntyTier: SovereigntyTier;
  localDetailVisible: boolean;
  regionalSummaryVisible: boolean;
  nationalEscalationsOnly: boolean;
  federatedScopeAllowed: boolean;
}

// ── Ledger ────────────────────────────────────────────────────────────────────

/**
 * A single entry in the sovereignty evidence ledger.
 */
export interface SovereigntyLedgerEntry {
  entryId: string;
  federationId: string;
  eventType:
    | 'delegation-granted'
    | 'delegation-revoked'
    | 'conflict-detected'
    | 'conflict-resolved'
    | 'escalation-triggered'
    | 'authority-exercised'
    | 'override-attempted'
    | 'override-rejected'
    | 'continuity-shared'
    | 'coordination-event';
  tier: SovereigntyTier;
  authority?: DelegatedAuthority;
  outcome: 'accepted' | 'rejected' | 'escalated' | 'pending';
  correlationId: string;
  governanceMode: 'shadow';
  timestamp: string;
  diagnostics: Record<string, unknown>;
}

// ── Simulation ────────────────────────────────────────────────────────────────

/**
 * Input contract for a cross-federation simulation scenario.
 */
export interface CrossFederationSimulationScenario {
  id: string;
  description: string;
  participatingTiers: SovereigntyTier[];
  eventType: CoordinationEventType;
  conflictTypes: SovereigntyConflictType[];
  assumptions: string[];
  expectedOutcomes: string[];
  escalationExpected: boolean;
  evidenceRequired: boolean;
}

/**
 * Result of a cross-federation simulation run.
 */
export interface CrossFederationSimulationResult {
  scenarioId: string;
  participatingTiers: SovereigntyTier[];
  conflictsDetected: SovereigntyConflictType[];
  resolutionPaths: ConflictResolutionPath[];
  escalationChain: SovereigntyTier[];
  outcomesMatched: boolean;
  actualOutcomes: string[];
  unmatchedExpected: string[];
  governanceMode: 'shadow';
  correlationId: string;
  diagnostics: Record<string, unknown>;
}

// ── Readiness Scores ──────────────────────────────────────────────────────────

/** Shadow-mode institutional autonomy readiness score. */
export interface FederationAutonomyScore {
  score: number;
  unitsAssessed: number;
  fullyAutonomousUnits: number;
  restrictedUnits: number;
}

/** Shadow-mode delegation governance score. */
export interface GovernanceDelegationScore {
  score: number;
  delegationGrantsValid: number;
  conflictsDetected: number;
  subDelegationExposure: number;
}

/** Shadow-mode continuity resilience score. */
export interface ContinuityResilienceScore {
  score: number;
  sharingAgreementsActive: number;
  continuityGapsDetected: number;
  jurisdictionIntact: boolean;
}

/** Shadow-mode jurisdiction integrity score. */
export interface JurisdictionIntegrityScore {
  score: number;
  auditVisibilityPoliciesValid: number;
  overrideViolationsDetected: number;
  aiJurisdictionConsistent: boolean;
}

/** Composite sovereignty readiness assessment. */
export interface SovereigntyReadinessAssessment {
  overall: number;
  autonomy: FederationAutonomyScore;
  delegation: GovernanceDelegationScore;
  continuity: ContinuityResilienceScore;
  jurisdiction: JurisdictionIntegrityScore;
  simulationCount: number;
  governanceMode: 'shadow';
  generatedAt: string;
}
