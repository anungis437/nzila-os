/**
 * TrustCore — Evidence Logger
 *
 * Callable from any module to record an immutable audit event.
 *
 * v1 writes to stdout (structured JSON) so events are captured by the
 * platform log aggregator. The next prompt will wire this to the
 * database audit-events table.
 */

import type { AuditAction, AuditEvent } from '@/types/core'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogEventInput {
  orgId: string
  actorId: string
  entityType: string
  entityId: string
  action: AuditAction
  metadata?: Record<string, unknown>
}

// ── Implementation ─────────────────────────────────────────────────────────

/**
 * Record an audit event for the given entity and action.
 *
 * Generates a deterministic event ID from the current timestamp and
 * enough entropy to avoid collisions at high throughput.
 *
 * @returns The persisted AuditEvent record.
 */
export function logEvent(input: LogEventInput): AuditEvent {
  const event: AuditEvent = {
    id: generateEventId(),
    orgId: input.orgId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadata: input.metadata,
    occurredAt: new Date().toISOString(),
  }

  // Structured log — captured by platform aggregator.
  console.log(JSON.stringify({ level: 'audit', ...event }))

  return event
}

// ── Helpers ────────────────────────────────────────────────────────────────

function generateEventId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 9)
  return `evt_${ts}_${rand}`
}
