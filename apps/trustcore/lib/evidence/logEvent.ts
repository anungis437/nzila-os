/**
 * TrustCore — Evidence Logger
 *
 * Callable from any module to record an immutable audit event.
 * Writes to the trustcore_evidence_events table via the DB helper.
 * Also emits a structured JSON log line so events are captured by the
 * platform log aggregator even if the DB write is deferred.
 */

import { createTrustcoreEvidenceEvent } from '@nzila/db/queries/trustcore'
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
 * Persists to the DB and emits a structured log line.
 *
 * @returns The persisted AuditEvent record.
 */
export async function logEvent(input: LogEventInput): Promise<AuditEvent> {
  const row = await createTrustcoreEvidenceEvent({
    orgId: input.orgId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    summary: undefined,
    metadata: input.metadata ?? null,
  })

  const event: AuditEvent = {
    id: row.id,
    orgId: row.orgId,
    actorId: row.actorId,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action as AuditAction,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    occurredAt: row.createdAt.toISOString(),
  }

  // Structured log — captured by platform aggregator.
  console.log(JSON.stringify({ level: 'audit', ...event }))

  return event
}
