/**
 * Pondu — Agri domain event emitter.
 *
 * Wraps @nzila/agri-events event bus for use in server actions.
 */
import {
  createAgriEventBus,
  createAgriEvent,
  AgriEventTypes,
  type AgriDomainEvent,
  type AgriEventType,
} from '@nzila/agri-events'

const bus = createAgriEventBus()

// TODO: Register integration handlers once outbox is available
// bus.on(AgriEventTypes.HARVEST_RECORDED, createIntegrationHandler(...))

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
