/**
 * @nzila/platform-events — Canonical Platform Event Types
 *
 * Defines the unified event envelope for all NzilaOS platform events.
 * This is the single source of truth for event shape across all verticals.
 *
 * DESIGN:
 *   - Extends DomainEvent pattern from commerce-events
 *   - Adds: source, schemaVersion, traceId, causationId, spanId
 *   - "org" nomenclature throughout (never "tenant")
 *   - Immutable payloads via Readonly<T>
 *
 * @module @nzila/platform-events/types
 */

// ── Event Metadata ──────────────────────────────────────────────────────────

/**
 * Metadata attached to every platform event for tracing and org isolation.
 */
export interface PlatformEventMetadata {
  /** Org that owns this event (never "tenant") */
  readonly orgId: string
  /** Actor who triggered the event (auth user ID or "system") */
  readonly actorId: string
  /** Correlation ID to group related events across services */
  readonly correlationId: string
  /** Causation ID — the event or action that caused this event */
  readonly causationId: string | null
  /** Source system/package that emitted this event */
  readonly source: string
  /** W3C Trace Context trace ID for distributed tracing */
  readonly traceId: string | null
  /** W3C Trace Context span ID */
  readonly spanId: string | null
}

// ── Event Envelope ──────────────────────────────────────────────────────────

/**
 * Canonical platform event envelope.
 * All events in NzilaOS flow through this shape.
 */
export interface PlatformEvent<TPayload = Record<string, unknown>> {
  /** Unique event ID (UUID v4) */
  readonly id: string
  /** Dot-namespaced event type, e.g. "integration.delivery.completed" */
  readonly type: string
  /** Schema version for forward/backward compat (semver-like: "1.0") */
  readonly schemaVersion: string
  /** Event payload — domain-specific, frozen at creation time */
  readonly payload: Readonly<TPayload>
  /** Event metadata for tracing, isolation, and audit */
  readonly metadata: PlatformEventMetadata
  /** ISO 8601 timestamp when the event was created */
  readonly createdAt: string
}

// ── Event Handler ───────────────────────────────────────────────────────────

/**
 * Async event handler. Receives a typed PlatformEvent.
 * Must not throw — errors are isolated by the bus.
 */
export type PlatformEventHandler<TPayload = Record<string, unknown>> = (
  event: PlatformEvent<TPayload>,
) => Promise<void> | void

/**
 * Unsubscribe function returned by bus.on()
 */
export type Unsubscribe = () => void

// ── Event Bus Interface ─────────────────────────────────────────────────────

/**
 * Platform event bus contract.
 * Implementations: InMemoryPlatformEventBus (default), outbox-backed (future).
 */
export interface PlatformEventBusInterface {
  /** Subscribe to a specific event type */
  on<TPayload = Record<string, unknown>>(
    eventType: string,
    handler: PlatformEventHandler<TPayload>,
  ): Unsubscribe

  /** Subscribe to all events (wildcard) */
  onAny(handler: PlatformEventHandler): Unsubscribe

  /** Fire-and-forget emit — handlers run async, errors are isolated */
  emit(event: PlatformEvent): void

  /** Emit and wait for all handlers to settle */
  emitAndWait(event: PlatformEvent): Promise<PromiseSettledResult<void>[]>

  /** Clear all subscriptions (test teardown) */
  clear(): void
}

// ── Event Store Interface ───────────────────────────────────────────────────

/**
 * Persistence layer for platform events.
 * Implementations: DrizzleEventStore (Postgres-backed).
 */
export interface EventStorePorts {
  /** Persist an event to the store */
  persist(event: PlatformEvent): Promise<void>
  /** Query events by type and org */
  queryByType(orgId: string, type: string, limit?: number): Promise<PlatformEvent[]>
  /** Query events by correlation ID */
  queryByCorrelation(correlationId: string): Promise<PlatformEvent[]>
  /** Count events (for metrics) */
  count(orgId: string, type?: string): Promise<number>
}

// ── Event Categories ────────────────────────────────────────────────────────

/**
 * Well-known platform event categories.
 * New verticals register their events here.
 */
export const PLATFORM_EVENT_CATEGORIES = {
  // Integration lifecycle
  INTEGRATION_DELIVERY_REQUESTED: 'integration.delivery.requested',
  INTEGRATION_DELIVERY_COMPLETED: 'integration.delivery.completed',
  INTEGRATION_DELIVERY_FAILED: 'integration.delivery.failed',
  INTEGRATION_CIRCUIT_OPENED: 'integration.circuit.opened',
  INTEGRATION_CIRCUIT_CLOSED: 'integration.circuit.closed',
  INTEGRATION_DLQ_ENTERED: 'integration.dlq.entered',
  INTEGRATION_DLQ_REPLAYED: 'integration.dlq.replayed',

  // Compliance & evidence
  EVIDENCE_PACK_CREATED: 'evidence.pack.created',
  EVIDENCE_PACK_SEALED: 'evidence.pack.sealed',
  EVIDENCE_PACK_VERIFIED: 'evidence.pack.verified',
  COMPLIANCE_SNAPSHOT_GENERATED: 'compliance.snapshot.generated',
  COMPLIANCE_SNAPSHOT_VERIFIED: 'compliance.snapshot.verified',

  // Observability
  HEALTH_CHECK_DEGRADED: 'observability.health.degraded',
  HEALTH_CHECK_RECOVERED: 'observability.health.recovered',
  SLO_BREACH_DETECTED: 'observability.slo.breach',

  // Audit
  AUDIT_CHAIN_BREAK: 'audit.chain.break',
  AUDIT_ACCESS_REVIEW: 'audit.access.review',

  // Platform lifecycle
  PLATFORM_DEPLOYMENT_STARTED: 'platform.deployment.started',
  PLATFORM_DEPLOYMENT_COMPLETED: 'platform.deployment.completed',
  ORG_PROVISIONED: 'platform.org.provisioned',
  ORG_SUSPENDED: 'platform.org.suspended',
} as const

export type PlatformEventCategory =
  (typeof PLATFORM_EVENT_CATEGORIES)[keyof typeof PLATFORM_EVENT_CATEGORIES]
