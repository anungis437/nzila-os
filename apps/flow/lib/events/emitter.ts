/**
 * Flow — Event Emitter
 *
 * Central event emission service. All domain events pass through here.
 * Integrates with @nzila/commerce-audit for persistence and audit trail.
 */
import { randomUUID } from 'node:crypto'
import { EmitEventInput, type FlowEvent } from './event-types'
import { logger } from '@/lib/logger'

// ── In-process event bus (listeners) ───────────────────────────────────────

type EventListener = (event: FlowEvent) => void | Promise<void>
const listeners: EventListener[] = []

export function onFlowEvent(listener: EventListener): () => void {
  listeners.push(listener)
  return () => {
    const idx = listeners.indexOf(listener)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

// ── Emit ───────────────────────────────────────────────────────────────────

export function emitFlowEvent(input: EmitEventInput): FlowEvent {
  const parsed = EmitEventInput.parse(input)

  const event: FlowEvent = {
    id: randomUUID(),
    type: parsed.type,
    actor_id: parsed.actor_id,
    org_id: parsed.org_id,
    entity_type: parsed.entity_type,
    entity_id: parsed.entity_id,
    timestamp: new Date(),
    metadata: parsed.metadata,
  }

  logger.info('Flow event emitted', {
    eventType: event.type,
    entityType: event.entity_type,
    entityId: event.entity_id,
    actorId: event.actor_id,
    orgId: event.org_id,
  })

  // Fire listeners asynchronously — don't block the caller
  for (const listener of listeners) {
    try {
      const result = listener(event)
      if (result instanceof Promise) {
        result.catch((err: unknown) => {
          logger.warn('Flow event listener error', {
            eventType: event.type,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }
    } catch (err: unknown) {
      logger.warn('Flow event listener sync error', {
        eventType: event.type,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return event
}

// ── Convenience Emitters ───────────────────────────────────────────────────

export function emitQuoteEvent(
  type: 'quote_created' | 'quote_sent' | 'quote_accepted' | 'quote_rejected' | 'quote_revision_requested' | 'quote_expired',
  actorId: string,
  orgId: string,
  quoteId: string,
  metadata: Record<string, unknown> = {},
): FlowEvent {
  return emitFlowEvent({
    type,
    actor_id: actorId,
    org_id: orgId,
    entity_type: 'quote',
    entity_id: quoteId,
    metadata,
  })
}

export function emitOrderEvent(
  type: 'order_created' | 'order_confirmed' | 'order_cancelled' | 'order_ready_for_procurement' | 'order_ready_to_ship' | 'order_shipped' | 'order_delivered' | 'order_closed',
  actorId: string,
  orgId: string,
  orderId: string,
  metadata: Record<string, unknown> = {},
): FlowEvent {
  return emitFlowEvent({
    type,
    actor_id: actorId,
    org_id: orgId,
    entity_type: 'order',
    entity_id: orderId,
    metadata,
  })
}

export function emitPaymentEvent(
  type: 'payment_received' | 'deposit_required' | 'payment_overdue',
  actorId: string,
  orgId: string,
  orderId: string,
  metadata: Record<string, unknown> = {},
): FlowEvent {
  return emitFlowEvent({
    type,
    actor_id: actorId,
    org_id: orgId,
    entity_type: 'order',
    entity_id: orderId,
    metadata,
  })
}

export function emitPOEvent(
  type: 'po_created' | 'po_sent' | 'po_confirmed' | 'po_in_production' | 'po_shipped' | 'po_received',
  actorId: string,
  orgId: string,
  poId: string,
  metadata: Record<string, unknown> = {},
): FlowEvent {
  return emitFlowEvent({
    type,
    actor_id: actorId,
    org_id: orgId,
    entity_type: 'purchase_order',
    entity_id: poId,
    metadata,
  })
}

export function emitProductionEvent(
  type: 'proof_sent' | 'proof_approved' | 'proof_rejected' | 'production_started' | 'production_completed' | 'quality_check_started' | 'quality_check_failed',
  actorId: string,
  orgId: string,
  jobId: string,
  metadata: Record<string, unknown> = {},
): FlowEvent {
  return emitFlowEvent({
    type,
    actor_id: actorId,
    org_id: orgId,
    entity_type: 'production_job',
    entity_id: jobId,
    metadata,
  })
}
