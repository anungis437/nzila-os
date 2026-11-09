/**
 * Cognition Memory Models
 *
 * Data structures for persistent organizational cognition memory.
 * Preserves continuity reasoning, simulation states, and governance context
 * over time — creating organizational cognition history.
 *
 * This is organizational continuity memory — not employee records.
 */

import type { SimulationScenario } from '../simulation/simulation-models';

export type CognitionMemoryType =
  | 'simulation_snapshot'
  | 'propagation_investigation'
  | 'mitigation_comparison'
  | 'governance_reasoning'
  | 'resilience_baseline'
  | 'continuity_assessment'
  | 'decision_brief';

/**
 * Every entry's provenance is one of two kinds, and the server - never the caller - decides which:
 *
 * - officer_asserted: an officer typed this in. It is valid organizational memory (a record of what someone
 *   believed or observed at the time), but nothing checked it against a real simulation, index or outcome at save
 *   time. It must never be presented as a verified or system-computed result.
 * - system_generated: the server itself computed this by actually running the named workflow (e.g.
 *   simulateContinuityImpact) with the given scenario and recording its real output, model version and the
 *   evidence it read. In principle reproducible from the same inputs against the same model version - though the
 *   underlying evidence may itself have since changed, so re-running it later is not guaranteed to produce the
 *   exact same output again.
 *
 * A caller can never relabel one kind of entry as the other: the save path for a given memoryType and input shape
 * decides which kind of entry that call produces (DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR).
 */
export type MemoryProvenance =
  | {
      source: 'officer_asserted';
      /** The officer who saved it; null for an entry saved before authorship was kept. */
      recordedBy: string | null;
    }
  | {
      source: 'system_generated';
      /** Who triggered the computation - a real identity, even though the output itself is not their assertion. */
      recordedBy: string | null;
      /** Name of the server workflow that produced this entry's payload. */
      workflow: 'simulateContinuityImpact';
      /** Version tag of the model/engine that computed this, for reproducibility tracking as the engine evolves. */
      modelVersion: string;
      /** The scenario given to the workflow - its real input, not an officer's free-text description of one. */
      scenario: SimulationScenario;
      /** When the computation ran (may differ slightly from the row's own createdAt). */
      computedAt: string;
      /** Ids of the organizational records the computation read as input (the exit interviews behind the dependency graph it was computed from). */
      inputEvidenceIds: string[];
    };

/** The payload key the server reserves for provenance; a caller cannot supply it. */
export const PROVENANCE_KEY = '__provenance';

export type MemoryStatus = 'active' | 'archived' | 'superseded';

export interface CognitionMemoryEntry {
  id: string;
  organizationId: string;
  memoryType: CognitionMemoryType;
  title: string;
  /** Rich context description — what was the organizational situation? */
  contextSummary: string;
  /** Serialized cognition state — graphs, simulations, analysis outputs */
  payload: Record<string, unknown>;
  /** Resilience score at the time of capture */
  resilienceScoreAtCapture: number | null;
  /** Tags for retrieval and filtering */
  tags: string[];
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  /** Which session this memory belongs to (optional) */
  sessionId: string | null;
  /** Key insights distilled from the payload */
  keyInsights: string[];
  provenance?: MemoryProvenance;
  /**
   * For a resilience_baseline entry only: the organizational resilience index
   * (lib/knowledge-transfer/resilience-index/resilience-calculator.ts) computed for this organization at the
   * moment this entry was saved, alongside the officer's own resilienceScoreAtCapture. This is an
   * ALGORITHM-COMPUTED ESTIMATE from the same kind of inferred, exit-interview-derived dependency graph - not an
   * independently verified measurement of organizational condition, and not inherently more "true" than the
   * officer's own figure. It lets a reader see the officer's assertion next to a second, differently-derived
   * estimate for the same moment (DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR).
   * Durably persisted at save time (not recomputed on each read): a later read of the same entry returns the
   * figure as it stood when the entry was saved, not a freshly recomputed one. Null when the entry is not a
   * resilience_baseline, no score was given, or there was no dependency data to compute an index from at save
   * time (not every organization has enough data for one to exist yet).
   */
  algorithmComputedResilienceIndexAtCapture?: number | null;
  /** Whether (and why, if not) this entry's figures could be reconciled against a current, real computation. See
   *  HistoricalVerificationStatus. Always { reconcilable: true, reason: 'not_applicable' } for anything that is not
   *  an officer_asserted simulation_snapshot. */
  historicalVerification?: HistoricalVerificationStatus;
}

export interface ResilienceSnapshotPoint {
  capturedAt: string;
  resilienceScore: number;
  memoryEntryId: string;
  title: string;
  /** The score is the one the officer typed when saving the entry. */
  source?: 'officer_asserted';
  changeFromPrevious: number | null;
}

export interface CognitionMemoryStore {
  organizationId: string;
  entries: CognitionMemoryEntry[];
  /** Chronological resilience evolution */
  resilienceTimeline: ResilienceSnapshotPoint[];
  totalEntries: number;
}

export interface SaveMemoryInput {
  memoryType: CognitionMemoryType;
  title: string;
  contextSummary: string;
  /** The officer's own statement. Required unless scenario is given for a simulation_snapshot (see below). */
  payload: Record<string, unknown>;
  resilienceScoreAtCapture?: number | null;
  tags?: string[];
  sessionId?: string | null;
  keyInsights?: string[];
  /**
   * For memoryType 'simulation_snapshot' only: when given, the server runs simulateContinuityImpact with this
   * scenario itself and persists the real result as a system_generated entry - payload is ignored for this call.
   * When omitted for a simulation_snapshot, the officer's own payload is saved as officer_asserted, same as any
   * other memory type.
   */
  scenario?: SimulationScenario;
}

/** Why a historical entry's figures cannot be reconciled against a current, real computation. */
export type VerificationUnavailableReason =
  | 'not_applicable' // the entry is not a type this applies to, or is already system_generated
  | 'predates_provenance_tracking' // saved before authorship/provenance was recorded at all
  | 'scenario_not_reconstructable'; // the original scenario/inputs were never captured in a replayable shape

/**
 * Whether, and why, a historical officer_asserted simulation_snapshot's figures could be reconciled against a
 * real, current computation. Computed on read, never stored: it reflects what is possible NOW, which can change as
 * provenance-aware entries accumulate. 'unavailable' is reported explicitly rather than silently treating an old
 * entry as equivalent to a verified one, or silently fabricating a replay it cannot faithfully reproduce.
 */
export interface HistoricalVerificationStatus {
  checked: boolean;
  reconcilable: boolean;
  reason: VerificationUnavailableReason | null;
}

