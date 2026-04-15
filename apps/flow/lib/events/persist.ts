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
  // Quote
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_revision_requested',
  'quote_submitted_for_review',
  // Order
  'order_created',
  'order_confirmed',
  'order_ready_for_procurement',
  'order_shipped',
  'order_completed',
  'order_delivered',
  // Payment
  'deposit_required',
  'payment_received',
  // Purchase Order
  'po_created',
  'po_sent',
  'po_confirmed',
  'po_line_received',
  'purchase_order_cancelled',
  // Production
  'production_started',
  'production_completed',
  'production_readiness_achieved',
  // Fulfillment / Shipment
  'fulfillment_started',
  'shipment_created',
  // Invoice
  'invoice_created',
  'invoice_issued',
  'invoice_voided',
  // System
  'sales_to_procurement_triggered',
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

export function isEventPersistenceInitialized(): boolean {
  return initialized
}

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
