/**
 * DealEngineEventService — bridges deal-engine events to platform-event-fabric.
 *
 * Wraps the PlatformEventBus so that adapter-level mutations can
 * emit typed domain events without coupling to a specific bus instance.
 */
import "server-only";

import {
  buildPlatformEvent,
  createPlatformEventBus,
  createInMemoryEventStore,
  type PlatformEventBus,
} from "@nzila/platform-event-fabric";
import { DEAL_ENGINE_EVENTS, type DealEngineEventType } from "@nzila/deal-engine/events";

let _bus: PlatformEventBus | null = null;

function getBus(): PlatformEventBus {
  if (!_bus) {
    _bus = createPlatformEventBus({ store: createInMemoryEventStore() });
  }
  return _bus;
}

export interface EmitOptions {
  actorId: string;
  tenantId: string;
  source?: string;
  correlationId?: string;
}

/**
 * Emit a deal-engine domain event onto the platform bus.
 */
export async function emitDealEvent(
  eventType: DealEngineEventType,
  payload: Record<string, unknown>,
  opts: EmitOptions,
): Promise<void> {
  const bus = getBus();
  const event = buildPlatformEvent({
    type: eventType,
    payload,
    tenantId: opts.tenantId,
    actorId: opts.actorId,
    source: opts.source ?? "control-plane:deal-engine",
  });
  await bus.publish(event);
}

/**
 * Subscribe to a specific deal-engine event type.
 * Returns an unsubscribe function.
 */
export function onDealEvent(
  eventType: DealEngineEventType,
  handler: (event: unknown) => Promise<void>,
): () => void {
  const bus = getBus();
  return bus.subscribe(eventType, handler);
}

/** Expose the event catalog for reference */
export { DEAL_ENGINE_EVENTS };
