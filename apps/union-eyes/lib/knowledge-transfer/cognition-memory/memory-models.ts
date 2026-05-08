/**
 * Cognition Memory Models
 *
 * Data structures for persistent organizational cognition memory.
 * Preserves continuity reasoning, simulation states, and governance context
 * over time — creating institutional cognition history.
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
}

export interface ResilienceSnapshotPoint {
  capturedAt: string;
  resilienceScore: number;
  memoryEntryId: string;
  title: string;
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
