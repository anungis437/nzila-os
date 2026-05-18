/**
 * Core type vocabulary for the governance-observability layer.
 *
 * These types classify, correlate, and retain every observable governance
 * event in Union Eyes. They are the shared language across:
 *
 *   - classification.ts  — classifying telemetry sensitivity + category
 *   - correlation.ts     — governance correlation ID chains
 *   - ledger.ts          — in-process evidence ledger
 *   - retention.ts       — retention class mappings
 *   - telemetry.ts       — governed telemetry adapter functions
 *
 * @module lib/governance-observability/types
 */

// ── Telemetry classification ─────────────────────────────────────────────────

/**
 * Sensitivity tier of a telemetry event.
 *
 * Maps to data-handling requirements:
 * - `public`       — may appear in buyer-facing reports
 * - `internal`     — org-internal operational telemetry
 * - `confidential` — restricted to governance/admin roles
 * - `restricted`   — legal-hold eligible; restricted access
 * - `regulated`    — subject to provincial/federal data rules (PIPEDA, etc.)
 */
export type TelemetrySensitivity =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'regulated';

/**
 * Functional category of a telemetry event.
 * Used for grouping, routing, and retention policy selection.
 */
export type TelemetryCategory =
  | 'auth'           // login, logout, token operations
  | 'governance'     // policy evaluation, contract resolution
  | 'ai-operation'   // AI/ML inference, generation, retrieval
  | 'publication'    // public-surface publish/approve/archive transitions
  | 'member-action'  // member-impacting operations (dues, case, grievance)
  | 'export'         // data export generation or delivery
  | 'audit'          // explicit audit log emission
  | 'federation'     // federation inheritance, escalation, restriction
  | 'security';      // rate limit breach, cross-org attempt, privilege escalation

// ── Correlation ────────────────────────────────────────────────────────────────

/**
 * A governance correlation context links related operations across a
 * request chain into a single traceable governance unit.
 *
 * The correlation context is created at request entry (e.g. middleware or
 * withApi) and propagated fire-and-forget to all governance operations
 * within that request.
 */
export interface GovernanceCorrelationContext {
  /**
   * Stable ID linking all governance events from a single request/workflow.
   * Format: `gcid_<random>` — never reused.
   */
  governanceCorrelationId: string;

  /**
   * Optional session-level grouping ID for multi-request governance workflows
   * (e.g. multi-step document approval). Format: `gsid_<random>`.
   */
  governanceSessionId?: string;

  /**
   * Optional trace ID for linking to distributed telemetry (e.g. OTEL spans).
   * Passed through from incoming `X-Trace-Id` or generated.
   * Format: `gtid_<random>`.
   */
  governanceTraceId?: string;

  /** ISO 8601 timestamp of context creation. */
  createdAt: string;

  /** Org context for this correlation. */
  orgId?: string;

  /** Actor who initiated the correlated governance operation chain. */
  actorId?: string;
}

// ── Observability event ────────────────────────────────────────────────────────

/**
 * A single governed observability event recorded to the in-process ledger.
 *
 * Events are accumulated and can be flushed to `reports/governance-evidence-correlation.json`
 * or forwarded to an external governance telemetry pipeline.
 */
export interface GovernanceObservabilityEvent {
  /** Unique event ID. Format: `gevt_<random>`. */
  eventId: string;

  /** Functional category of this event. */
  category: TelemetryCategory;

  /** Sensitivity tier — drives data-handling and retention rules. */
  sensitivity: TelemetrySensitivity;

  /** Stable operation identifier (route path, surface id, AI operation, etc.). */
  operationId: string;

  /** Governance correlation context that links this event to related events. */
  correlation: GovernanceCorrelationContext;

  /** ISO 8601 timestamp of event creation. */
  timestamp: string;

  /**
   * Retention class assigned to this event.
   * Determined by `mapCategoryToRetention()` / `mapSensitivityToRetention()`.
   */
  retentionClass: import('./retention').RetentionClass;

  /** Governance policy contract ID associated with this event (if applicable). */
  contractId?: string;

  /**
   * Governance mode active when this event was recorded.
   * All Wave 8 events default to `shadow`.
   */
  governanceMode: 'shadow' | 'enforce';

  /** Optional structured payload — sanitized, no PII in default serialisation. */
  metadata?: Record<string, unknown>;
}

// ── AI trace ─────────────────────────────────────────────────────────────────

/**
 * Extended governance trace fields for AI-assisted operations.
 * Appended to `GovernanceObservabilityEvent.metadata` for AI events.
 */
export interface AIGovernanceTrace {
  aiOperationId: string;
  risk: import('../governance-policy/types').AIActionRisk;
  humanReviewTriggered: boolean;
  sensitiveOperationEscalated: boolean;
  /** Whether the AI output was destined for public visibility. */
  publicOutput: boolean;
  /** Whether member data was involved. */
  memberDataAccessed: boolean;
}

// ── Federation trace ──────────────────────────────────────────────────────────

/**
 * Extended governance trace for federation-level events.
 */
export interface FederationGovernanceTrace {
  orgId: string;
  parentOrgId?: string;
  tier: import('../governance-policy/types').FederationTier;
  /** The contract ID that triggered the federation event. */
  contractId: string;
  /** Whether a local override attempt was rejected. */
  overrideRejected: boolean;
  /** Whether this event was escalated to the parent federation. */
  escalatedToParent: boolean;
  /** Whether a publication was denied due to federation restrictions. */
  publicationDenied: boolean;
}
