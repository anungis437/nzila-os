/**
 * ARTIFACT TYPE: Runtime Contract
 * MODULE: OCI Runtime Infrastructure
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity-native runtime contracts for Product 4.
 *
 * These contracts are the single source of truth for the shapes that flow
 * between OCI runtime engines. They are intentionally narrow: every contract
 * carries the minimum organizational context required to remain readable.
 *
 * Posture:
 *   - Read-only by default. No contract here authorises a write back to the
 *     institution's governance record.
 *   - Reviewer-led. Every contract carries a `reviewerRefId` for traceability.
 *   - Anti-surveillance. No contract carries personally identifying details.
 *   - Refusal-friendly. Optional fields are genuinely optional; missing values
 *     never imply absence of the underlying organizational reality.
 */

export const RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitive types
// ─────────────────────────────────────────────────────────────────────────────

export type ContinuityRuntimeBand =
  | 'not_yet_readable'
  | 'holding'
  | 'stabilizing'
  | 'regressing';

export type ContinuitySensitivity =
  | 'unknown'
  | 'standard'
  | 'continuity_sensitive'
  | 'continuity_critical';

// ─────────────────────────────────────────────────────────────────────────────
// RuntimeLineageReference
//
// A read-only handle to an upstream organizational artefact. Lineage references
// are NOT URLs. They are organizational identifiers the runtime can resolve only
// through a reviewer-led lookup.
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeLineageReference {
  readonly refKind:
    | 'governance_ratification'
    | 'stewardship_redistribution'
    | 'intervention_ledger_entry'
    | 'onboarding_workflow'
    | 'executive_reading'
    | 'workbook_chapter';
  readonly refId: string;
  readonly statedAt: string; // ISO-8601
  readonly institutionScope: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceMemoryReference
//
// A read-only handle to a rationale envelope persisted by the Governance Memory
// Runtime. The runtime never returns the envelope contents through this
// reference alone; a reviewer-led read is required.
// ─────────────────────────────────────────────────────────────────────────────

export interface GovernanceMemoryReference {
  readonly memoryId: string;
  readonly recordedAt: string; // ISO-8601
  readonly institutionScope: string;
  readonly subjectKind:
    | 'governance_decision'
    | 'modernization_decision'
    | 'stewardship_transition'
    | 'operational_interpretation'
    | 'continuity_sensitive_change';
  readonly reviewerRefId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ContinuityRuntimeContext
//
// The minimal context an operational system needs to behave continuity-aware
// without inferring intent. The runtime supplies this; callers do not fabricate
// it.
// ─────────────────────────────────────────────────────────────────────────────

export interface ContinuityRuntimeContext {
  readonly institutionScope: string;
  readonly sensitivity: ContinuitySensitivity;
  readonly governanceLineage: readonly RuntimeLineageReference[];
  readonly stewardshipConcentrationBand: ContinuityRuntimeBand;
  readonly survivabilityBand: ContinuityRuntimeBand;
  readonly readinessSufficient: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// ContinuityEventEnvelope
//
// The canonical envelope for every event the Continuity Event Runtime emits.
// Events are deterministic statements about organizational movement; they are
// never predictions and never recommendations.
// ─────────────────────────────────────────────────────────────────────────────

export type ContinuityEventKind =
  | 'GovernanceInterpretationChanged'
  | 'StewardshipConcentrationElevated'
  | 'OperationalDependencyReduced'
  | 'OnboardingSurvivabilityImproved'
  | 'ContinuityBreakpointIntroduced'
  | 'ReconstructionBurdenReduced'
  | 'GovernanceRecoveryRatified'
  | 'RuntimeTransitionActivated'
  | 'InstitutionalMemoryRiskElevated'
  | 'ModernizationContinuityGapDetected';

export type ContinuityEventSeverity =
  | 'note'
  | 'observation'
  | 'warning'
  | 'critical';

export interface ContinuityEventEnvelope {
  readonly contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  readonly eventId: string;
  readonly kind: ContinuityEventKind;
  readonly severity: ContinuityEventSeverity;
  readonly observedAt: string; // ISO-8601
  readonly institutionScope: string;
  readonly statement: string;
  readonly lineage: readonly RuntimeLineageReference[];
  readonly memoryReferences: readonly GovernanceMemoryReference[];
  readonly evidence: Readonly<Record<string, unknown>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// StewardshipTransferRecord
//
// A read-only record of a stewardship redistribution event. The record never
// names individuals; it identifies role-states.
// ─────────────────────────────────────────────────────────────────────────────

export interface StewardshipTransferRecord {
  readonly contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  readonly transferId: string;
  readonly institutionScope: string;
  readonly originRoleState: string;
  readonly destinationRoleState: string;
  readonly reversibilityWindowClosed: boolean;
  readonly consentRecorded: boolean;
  readonly continuityCarriedBand: ContinuityRuntimeBand;
  readonly statedAt: string;
  readonly lineage: readonly RuntimeLineageReference[];
}

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingSurvivabilityRecord
//
// A read-only record of an organizational onboarding artefact's contribution to
// survivability. Never a measurement of any individual successor.
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingSurvivabilityRecord {
  readonly contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  readonly recordId: string;
  readonly institutionScope: string;
  readonly workflowRefId: string;
  readonly completionsRecorded: number;
  readonly contextPreservedBand: ContinuityRuntimeBand;
  readonly reconstructionBurdenBand: ContinuityRuntimeBand;
  readonly statedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RuntimeContinuitySignal
//
// The canonical envelope for signals emitted by runtime engines (distinct from
// event envelopes: signals are continuous readings; events are discrete
// movements).
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeContinuitySignal {
  readonly contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  readonly signalId: string;
  readonly severity: ContinuityEventSeverity;
  readonly category: string;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}
