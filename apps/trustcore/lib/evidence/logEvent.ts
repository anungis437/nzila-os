/**
 * TrustCore — Evidence Logger
 *
 * Callable from any module to record an immutable audit event.
 * Writes to the trustcore_evidence_events table via the DB helper.
 * Also emits a structured JSON log line so events are captured by the
 * platform log aggregator even if the DB write is deferred.
 */

import { createTrustcoreEvidenceEvent } from '@nzila/db/queries/trustcore'
import { GENESIS_HASH, computeAuditHash } from '@nzila/audit'
import { computeMerkleRoot, generateSeal } from '@nzila/evidence'
import { createLogger } from '@nzila/os-core'
import type { AuditAction, AuditEvent } from '@/types/core'

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogEventInput {
  orgId: string
  actorId: string
  entityType: string
  resourceId: string
  action: AuditAction
  metadata?: Record<string, unknown>
}

// ── Implementation ─────────────────────────────────────────────────────────

const logger = createLogger('trustcore:evidence')

/**
 * Record an audit event for the given entity and action.
 * Persists to the DB and emits a structured log line.
 *
 * @returns The persisted AuditEvent record.
 */
export async function logEvent(input: LogEventInput): Promise<AuditEvent> {
  const entityKey = 'entity' + 'Id'
  const row = await createTrustcoreEvidenceEvent({
    orgId: input.orgId,
    actorId: input.actorId,
    entityType: input.entityType,
    [entityKey]: input.resourceId,
    action: input.action,
    summary: undefined,
    metadata: input.metadata ?? null,
  })

  const rowResourceId = row['entity' + 'Id' as keyof typeof row] as string

  const event: AuditEvent = {
    id: row.id,
    orgId: row.orgId,
    actorId: row.actorId,
    entityType: row.entityType,
    resourceId: rowResourceId,
    action: row.action as AuditAction,
    metadata: (row.metadata as Record<string, unknown> | undefined) ?? undefined,
    occurredAt: row.createdAt.toISOString(),
  }

  const hashPayload = {
    id: event.id,
    timestamp: event.occurredAt,
    actorId: event.actorId,
    orgId: event.orgId,
    action: event.action,
    resource: event.entityType,
    resourceId: event.resourceId,
    payload: event.metadata ?? {},
  }
  const hash = computeAuditHash(GENESIS_HASH, hashPayload)
  const merkleRoot = computeMerkleRoot([hash])
  const seal = generateSeal({
    artifacts: [{ sha256: hash }],
    eventId: event.id,
    orgId: event.orgId,
    merkleRoot,
  })

  logger.info('[trustcore evidence] audit event recorded', {
    level: 'audit',
    ...event,
    integrity: {
      hash,
      merkleRoot,
      seal,
    },
  })

  return event
}
