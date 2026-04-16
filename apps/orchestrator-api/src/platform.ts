/**
 * Orchestrator API — Platform Integration Hooks
 *
 * Wires platform-event-fabric so that command lifecycle events are
 * observable across the platform.
 *
 * Policy evaluation is NOT the Orchestrator's concern. All policy
 * decisions flow through the Control Plane before commands reach here.
 * The Orchestrator is a pure execution engine.
 */
import {
  createPlatformEventBus,
  createInMemoryEventStore,
  buildPlatformEvent,
  type PlatformEventBus,
} from '@nzila/platform-event-fabric'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('orchestrator-platform')

// ── Event Fabric ────────────────────────────────────────────────────────────

let eventBus: PlatformEventBus | null = null

export function getEventBus(): PlatformEventBus {
  if (!eventBus) {
    const store = createInMemoryEventStore()
    eventBus = createPlatformEventBus({ store })
    logger.info('Platform event bus initialized (in-memory store)')
  }
  return eventBus
}

/**
 * Emit a command lifecycle event to the platform event bus.
 */
export async function emitCommandEvent(
  eventType: string,
  payload: Record<string, unknown>,
  actorId: string,
  tenantId = 'system',
): Promise<void> {
  const bus = getEventBus()
  const event = buildPlatformEvent({
    type: eventType as Parameters<typeof buildPlatformEvent>[0]['type'],
    payload,
    actorId,
    tenantId,
    source: 'orchestrator-api',
  })
  await bus.publish(event)
  logger.info('Platform event emitted', { eventType, actorId })
}
