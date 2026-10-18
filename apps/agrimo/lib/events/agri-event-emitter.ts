/**
 * Agrimo — Agri domain event emitter.
 *
 * Wraps @nzila/agri-events event bus for use in server actions.
 * Registers integration handlers for audit logging and webhook dispatch.
 */
import {
  createAgriEventBus,
  createAgriEvent,
  AgriEventTypes,
  type AgriDomainEvent,
  type AgriEventType,
} from '@nzila/agri-events'
import { createLogger, writeDiagnostic } from '@nzila/os-core/telemetry'

const bus = createAgriEventBus()
const logger = createLogger('agrimo:agri-event')

// ── Audit logging handler — logs every domain event for observability ────
bus.onAny(async (event: AgriDomainEvent) => {
  writeDiagnostic(logger, 'info', 'Agri event emitted', {
    type: event.type,
    createdAt: event.createdAt,
  })
})

// ── Webhook handler — POST to org-configured webhook URL ────────────────
bus.on(AgriEventTypes.LOT_CERTIFIED, async (event: AgriDomainEvent) => {
  const webhookUrl = process.env.AGRI_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: event.type, payload: event.payload, metadata: event.metadata }),
    })
  } catch {
    writeDiagnostic(logger, 'error', 'Webhook delivery failed')
  }
})

bus.on(AgriEventTypes.SHIPMENT_CLOSED, async (event: AgriDomainEvent) => {
  const webhookUrl = process.env.AGRI_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: event.type, payload: event.payload, metadata: event.metadata }),
    })
  } catch {
    writeDiagnostic(logger, 'error', 'Webhook delivery failed')
  }
})

bus.on(AgriEventTypes.PAYMENT_EXECUTED, async (event: AgriDomainEvent) => {
  const webhookUrl = process.env.AGRI_WEBHOOK_URL
  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: event.type, payload: event.payload, metadata: event.metadata }),
    })
  } catch {
    writeDiagnostic(logger, 'error', 'Webhook delivery failed')
  }
})

export function emitAgriEvent(
  type: AgriEventType,
  orgId: string,
  actorId: string,
  payload: Record<string, unknown>,
): AgriDomainEvent {
  const event = createAgriEvent(type, payload, {
    orgId,
    actorId,
    correlationId: crypto.randomUUID(),
  })
  bus.emit(event)
  return event
}

export { bus as agriEventBus, AgriEventTypes }
