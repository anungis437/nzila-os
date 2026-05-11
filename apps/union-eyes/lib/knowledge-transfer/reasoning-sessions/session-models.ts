/**
 * Reasoning Session Models
 *
 * Data structures for organizational continuity reasoning sessions.
 * Sessions maintain longitudinal continuity reasoning context across interactions.
 *
 * Sessions are organizational — not personal user profiles.
 */

export type SessionStatus = 'active' | 'paused' | 'completed' | 'archived';

export type SessionFocus =
  | 'general_continuity'
  | 'governance_investigation'
  | 'resilience_planning'
  | 'simulation_exploration'
  | 'mitigation_planning'
  | 'dependency_analysis';

export interface SessionAnnotation {
  id: string;
  text: string;
  createdAt: string;
  /** Which graph node or analysis area this annotation is attached to */
  targetRef: string | null;
}

export interface SessionGraphState {
  /** Active overlay mode in the cognition graph */
  overlayMode: string | null;
  /** IDs of highlighted nodes */
  highlightedNodes: string[];
  /** IDs of expanded nodes */
  expandedNodes: string[];
  /** Active category filter */
  categoryFilter: string | null;
  /** Active propagation path index */
  highlightedPathIndex: number | null;
}

export interface SessionSimulationRef {
  scenarioType: string;
  label: string;
  durationWeeks: number;
  /** Linked cognition memory ID if persisted */
  memoryEntryId: string | null;
}

export interface ReasoningSession {
  id: string;
  organizationId: string;
  title: string;
  focus: SessionFocus;
  status: SessionStatus;
  /** Shared context description for this session */
  contextDescription: string;
  /** Preserved graph exploration state */
  graphState: SessionGraphState | null;
  /** Active simulations in this session */
  activeSimulations: SessionSimulationRef[];
  /** Session annotations and governance observations */
  annotations: SessionAnnotation[];
  /** Conversation message IDs linked to this session */
  linkedMessageIds: string[];
  /** Linked cognition memory entry IDs */
  linkedMemoryEntryIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Latest resilience score captured during this session */
  latestResilienceScore: number | null;
}

export interface CreateSessionInput {
  title: string;
  focus: SessionFocus;
  contextDescription?: string;
}

export interface UpdateSessionInput {
  title?: string;
  contextDescription?: string;
  graphState?: SessionGraphState | null;
  status?: SessionStatus;
  latestResilienceScore?: number | null;
}
