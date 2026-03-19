/**
 * Flow — Event Dispatcher
 *
 * Bridges the control layer with the existing Flow event system.
 * Every successful command handler emits domain events through this dispatcher.
 */
import { emitFlowEvent } from '@/lib/events/emitter'
import type { FlowEventType } from '@/lib/events/event-types'
import { logger } from '@/lib/logger'

export interface DispatchEventInput {
  type: FlowEventType
  actor_id: string
  org_id: string
  entity_type: string
  entity_id: string
  correlation_id?: string
  metadata?: Record<string, unknown>
}

export function dispatchDomainEvent(input: DispatchEventInput): string {
  const event = emitFlowEvent({
    type: input.type,
    actor_id: input.actor_id,
    org_id: input.org_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    metadata: {
      ...input.metadata,
      ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    },
  })

  logger.info('Domain event dispatched', {
    eventId: event.id,
    eventType: event.type,
    entityType: event.entity_type,
    entityId: event.entity_id,
  })

  return event.id
}

export function dispatchMultipleEvents(inputs: DispatchEventInput[]): string[] {
  return inputs.map(dispatchDomainEvent)
}
