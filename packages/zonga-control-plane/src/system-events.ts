/**
 * @nzila/zonga-control-plane — System Events
 *
 * Unified event bus for all system-level audit events.
 * Every critical action emits a SystemEvent through this layer.
 * Events are immutable, timestamped, and correlated.
 */
import type { SystemEvent } from './types'
import { AuditSeverity, type SystemEventType } from './types'

// ── Event Bus ─────────────────────────────────────────────────────────────

type SystemEventHandler = (event: SystemEvent) => void

const eventHandlers: SystemEventHandler[] = []
const eventLog: SystemEvent[] = []

let eventIdCounter = 0

function generateEventId(): string {
  eventIdCounter++
  return `sysevt_${Date.now()}_${eventIdCounter}`
}

/**
 * Register a handler that receives all system events.
 */
export function onSystemEvent(handler: SystemEventHandler): () => void {
  eventHandlers.push(handler)
  return () => {
    const idx = eventHandlers.indexOf(handler)
    if (idx >= 0) eventHandlers.splice(idx, 1)
  }
}

/**
 * Emit a system event to all registered handlers.
 * Events are also stored in the in-memory log for audit queries.
 */
export function emitSystemEvent(event: SystemEvent): void {
  eventLog.push(event)
  for (const handler of eventHandlers) {
    try {
      handler(event)
    } catch {
      // Handlers must not crash the event bus
    }
  }
}

/**
 * Build a system event with sensible defaults.
 */
export function buildSystemEvent(params: {
  type: SystemEventType
  orgId: string
  actorId: string
  entityId: string
  entityType: string
  correlationId: string
  workflowId?: string
  workflowExecutionId?: string
  payload: Record<string, unknown>
  beforeState?: Record<string, unknown>
  afterState?: Record<string, unknown>
  severity: AuditSeverity
  reason?: string
}): SystemEvent {
  return {
    id: generateEventId(),
    type: params.type,
    orgId: params.orgId,
    actorId: params.actorId,
    entityId: params.entityId,
    entityType: params.entityType,
    correlationId: params.correlationId,
    workflowId: params.workflowId,
    workflowExecutionId: params.workflowExecutionId,
    timestamp: new Date(),
    payload: params.payload,
    beforeState: params.beforeState,
    afterState: params.afterState,
    severity: params.severity,
    reason: params.reason,
  }
}

// ── Audit Query Service ───────────────────────────────────────────────────

export interface AuditQueryFilter {
  readonly entityId?: string
  readonly entityType?: string
  readonly actorId?: string
  readonly workflowId?: string
  readonly correlationId?: string
  readonly eventType?: SystemEventType
  readonly severity?: AuditSeverity
  readonly fromDate?: Date
  readonly toDate?: Date
  readonly limit?: number
  readonly offset?: number
}

export interface AuditQueryResult {
  readonly events: readonly SystemEvent[]
  readonly totalCount: number
  readonly hasMore: boolean
}

/**
 * Query audit events by filter criteria.
 * Supports filtering by entity, actor, workflow, time range, severity.
 */
export function queryAuditEvents(filter: AuditQueryFilter): AuditQueryResult {
  let filtered = eventLog.slice()

  if (filter.entityId) {
    filtered = filtered.filter((e) => e.entityId === filter.entityId)
  }
  if (filter.entityType) {
    filtered = filtered.filter((e) => e.entityType === filter.entityType)
  }
  if (filter.actorId) {
    filtered = filtered.filter((e) => e.actorId === filter.actorId)
  }
  if (filter.workflowId) {
    filtered = filtered.filter((e) => e.workflowId === filter.workflowId)
  }
  if (filter.correlationId) {
    filtered = filtered.filter((e) => e.correlationId === filter.correlationId)
  }
  if (filter.eventType) {
    filtered = filtered.filter((e) => e.type === filter.eventType)
  }
  if (filter.severity) {
    filtered = filtered.filter((e) => e.severity === filter.severity)
  }
  if (filter.fromDate) {
    filtered = filtered.filter((e) => e.timestamp >= filter.fromDate!)
  }
  if (filter.toDate) {
    filtered = filtered.filter((e) => e.timestamp <= filter.toDate!)
  }

  const totalCount = filtered.length
  const offset = filter.offset ?? 0
  const limit = filter.limit ?? 100
  const paged = filtered.slice(offset, offset + limit)

  return {
    events: paged,
    totalCount,
    hasMore: offset + limit < totalCount,
  }
}

/**
 * Get event count by type for observability dashboards.
 */
export function getEventCountByType(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const event of eventLog) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1)
  }
  return counts
}

/**
 * Clear the in-memory event log (useful for testing).
 */
export function clearEventLog(): void {
  eventLog.length = 0
}

/**
 * Get a snapshot of the in-memory event log (useful for testing).
 */
export function getEventLog(): readonly SystemEvent[] {
  return eventLog.slice()
}

/**
 * Get the full event log length.
 */
export function getEventLogSize(): number {
  return eventLog.length
}
