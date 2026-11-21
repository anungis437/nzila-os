/**
 * DealEngineEventService — bridges deal-engine events to platform-event-fabric.
 *
 * Wraps the PlatformEventBus so that adapter-level mutations can
 * emit typed domain events without coupling to a specific bus instance.
 *
 * Uses a DB-backed event store for durability across restarts.
 * Includes idempotency: duplicate events with the same correlationId
 * within a window are silently dropped.
 */
import 'server-only'

import { logger } from '@/lib/telemetry'
import {
  buildPlatformEvent,
  createPlatformEventBus,
  type PlatformEventBus,
} from '@nzila/platform-event-fabric'
import { DEAL_ENGINE_EVENTS, type DealEngineEventType } from '@nzila/deal-engine/events'

import { createDbEventStore } from '@/db/adapters/events'

let _bus: PlatformEventBus | null = null

function getBus(): PlatformEventBus {
  if (!_bus) {
    _bus = createPlatformEventBus({ store: createDbEventStore() })
  }
  return _bus
}

// ── Idempotency guard ───────────────────────────────────

const IDEMPOTENCY_WINDOW_MS = 60_000 // 1 minute
// ga-check:exempt — ephemeral dedup cache with TTL, not a persistence store
const _seen = new Map<string, number>()

function isDuplicate(correlationId: string | undefined): boolean {
  if (!correlationId) return false
  const now = Date.now()
  // Prune stale entries periodically
  if (_seen.size > 500) {
    for (const [key, ts] of _seen) {
      if (now - ts > IDEMPOTENCY_WINDOW_MS) _seen.delete(key)
    }
  }
  const lastSeen = _seen.get(correlationId)
  if (lastSeen && now - lastSeen < IDEMPOTENCY_WINDOW_MS) return true
  _seen.set(correlationId, now)
  return false
}

export interface EmitOptions {
  actorId: string
  tenantId: string
  source?: string
  correlationId?: string
}

/**
 * Emit a deal-engine domain event onto the platform bus.
 * Events with the same correlationId within the idempotency window are dropped.
 */
export async function emitDealEvent(
  eventType: DealEngineEventType,
  payload: Record<string, unknown>,
  opts: EmitOptions,
): Promise<void> {
  if (isDuplicate(opts.correlationId)) {
    logger.info('[EVENT] duplicate event dropped', { eventType, correlationId: opts.correlationId })
    return
  }

  try {
    const bus = getBus()
    const event = buildPlatformEvent({
      type: eventType,
      payload,
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      source: opts.source ?? 'control-plane:deal-engine',
    })
    await bus.publish(event)
  } catch (err) {
    logger.error('[EVENT] emitDealEvent failed', { eventType, error: err })
  }
}

/**
 * Subscribe to a specific deal-engine event type.
 * Returns an unsubscribe function.
 */
export function onDealEvent(
  eventType: DealEngineEventType,
  handler: (event: unknown) => Promise<void>,
): () => void {
  const bus = getBus()
  return bus.subscribe(eventType, handler)
}

/** Expose the event catalog for reference */
export { DEAL_ENGINE_EVENTS }
