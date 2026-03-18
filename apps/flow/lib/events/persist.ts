/**
 * Flow — Domain Event Persistence
 *
 * Writes FlowEvents to the `flow_domain_events` table for audit trail.
 * Registers as an async listener on the in-process event bus.
 *
 * Only events whose type exists in the DB `flow_event_type` enum are persisted.
 * Unknown types are logged and silently skipped — no data loss since the
 * in-process bus still dispatches them to other listeners.
 */
import { db, flowDomainEvents } from '@nzila/db'
import { logger } from '@/lib/logger'
import type { FlowEvent } from './event-types'
import { onFlowEvent } from './emitter'

// ── DB-supported event types ───────────────────────────────────────────────
// Must match the pgEnum values in packages/db/src/schema/flow/enums.ts
const DB_EVENT_TYPES = new Set([
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_revision_requested',
  'order_created',
  'deposit_required',
  'payment_received',
  'po_created',
  'po_sent',
  'po_confirmed',
  'production_started',
  'production_completed',
  'shipment_created',
  'order_delivered',
] as const)

type DbEventType = typeof DB_EVENT_TYPES extends Set<infer T> ? T : never

// ── Persist a single event ─────────────────────────────────────────────────

export async function persistFlowEvent(event: FlowEvent): Promise<boolean> {
  if (!DB_EVENT_TYPES.has(event.type as DbEventType)) {
    logger.debug('Skipping event persistence — type not in DB enum', {
      eventType: event.type,
      entityId: event.entity_id,
    })
    return false
  }

  await db.insert(flowDomainEvents).values({
    id: event.id,
    orgId: event.org_id,
    entityType: event.entity_type,
    entityId: event.entity_id,
    eventType: event.type as DbEventType,
    actorId: event.actor_id,
    payloadJson: event.metadata,
    createdAt: event.timestamp,
  })

  return true
}

// ── Bootstrap: register the persistence listener ───────────────────────────

let initialized = false

export function initEventPersistence(): void {
  if (initialized) return
  initialized = true

  onFlowEvent(async (event) => {
    try {
      await persistFlowEvent(event)
    } catch (err: unknown) {
      logger.error('Failed to persist flow event', {
        eventType: event.type,
        entityId: event.entity_id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })

  logger.info('Flow event persistence listener registered')
}
