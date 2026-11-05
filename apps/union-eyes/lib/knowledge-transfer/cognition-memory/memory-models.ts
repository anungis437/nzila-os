/**
 * Cognition Memory Models
 *
 * Data structures for persistent organizational cognition memory.
 * Preserves continuity reasoning, simulation states, and governance context
 * over time — creating organizational cognition history.
 *
 * This is organizational continuity memory — not employee records.
 */

export type CognitionMemoryType =
  | 'simulation_snapshot'
  | 'propagation_investigation'
  | 'mitigation_comparison'
  | 'governance_reasoning'
  | 'resilience_baseline'
  | 'continuity_assessment'
  | 'decision_brief';

/**
 * Every entry is something an officer typed in: the server does not check a snapshot, score or insight against a real
 * simulation or index. The author is kept so a figure can always be traced to the person who stated it.
 */
export interface MemoryProvenance {
  source: 'officer_asserted';
  /** The officer who saved it; null for an entry saved before authorship was kept. */
  recordedBy: string | null;
}

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
  payload: Record<string, unknown>;
  resilienceScoreAtCapture?: number | null;
  tags?: string[];
  sessionId?: string | null;
  keyInsights?: string[];
}
