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
  type PlatformEventStore,
} from '@nzila/platform-event-fabric'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('orchestrator-platform')

// ── Event Fabric ────────────────────────────────────────────────────────────

let eventBus: PlatformEventBus | null = null
let injectedStore: PlatformEventStore | null = null

/**
 * Inject a custom event store BEFORE first `getEventBus()` call.
 *
 * The default in-memory store is single-instance only — events persisted
 * by replica A are invisible to replica B and lost on restart. Production
 * deploys that need HA, horizontal scaling, or durable replay must inject
 * a durable store (Postgres, Redis Streams, Kafka, etc.) at process
 * bootstrap, e.g.:
 *
 *   import { setEventStore } from './platform'
 *   import { createRedisEventStore } from './stores/redis-event-store'
 *   setEventStore(createRedisEventStore(redis))
 *
 * Calling this after the bus is already initialised throws — fail loudly
 * rather than silently keeping the old store.
 */
export function setEventStore(store: PlatformEventStore): void {
  if (eventBus !== null) {
    throw new Error(
      'setEventStore() must be called before the first getEventBus() — event bus already initialised.',
    )
  }
  injectedStore = store
  logger.info('Custom event store injected for orchestrator platform')
}

/**
 * Reset the bus (test-only). Production code must never call this.
 */
export function resetEventBusForTests(): void {
  eventBus = null
  injectedStore = null
}

export function getEventBus(): PlatformEventBus {
  if (!eventBus) {
    const store = injectedStore ?? createInMemoryEventStore()
    const usingInMemory = injectedStore === null
    eventBus = createPlatformEventBus({ store })
    if (usingInMemory) {
      if (process.env.NODE_ENV === 'production' && process.env.ORCHESTRATOR_ALLOW_IN_MEMORY_EVENT_STORE !== '1') {
        logger.error(
          'Orchestrator booting in production with in-memory event store — events will be LOST on restart and INVISIBLE across replicas. Inject a durable store via setEventStore() or set ORCHESTRATOR_ALLOW_IN_MEMORY_EVENT_STORE=1 to acknowledge.',
        )
      } else {
        logger.info('Platform event bus initialized (in-memory store)')
      }
    } else {
      logger.info('Platform event bus initialized (injected durable store)')
    }
  }
  return eventBus
}

/**
 * Emit a command lifecycle event to the platform event bus.
 *
 * Callers commonly invoke this fire-and-forget (`void emitCommandEvent(...)`)
 * from within request handlers. To avoid silently dropping bus failures, this
 * function catches and logs any publish error internally — the returned
 * promise is guaranteed not to reject. If you need to react to a failure,
 * pass an `onError` handler or `await` and inspect the result.
 */
export async function emitCommandEvent(
  eventType: string,
  payload: Record<string, unknown>,
  actorId: string,
  tenantId = 'system',
  onError?: (err: Error) => void,
): Promise<{ ok: boolean; error?: Error }> {
  try {
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
    return { ok: true }
  } catch (rawErr) {
    const err = rawErr instanceof Error ? rawErr : new Error(String(rawErr))
    logger.error('Platform event emission failed', {
      eventType,
      actorId,
      tenantId,
      error: err.message,
      stack: err.stack,
    })
    if (onError) {
      try {
        onError(err)
      } catch (handlerErr) {
        logger.error('emitCommandEvent onError handler threw', {
          error: handlerErr instanceof Error ? handlerErr.message : String(handlerErr),
        })
      }
    }
    return { ok: false, error: err }
  }
}
