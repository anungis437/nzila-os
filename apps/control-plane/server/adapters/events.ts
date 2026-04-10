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
import "server-only";

import { db } from "@nzila/db";
import { sql } from "drizzle-orm";
import { dealEngineEvents } from "./schemas";
import {
  buildPlatformEvent,
  createPlatformEventBus,
  type PlatformEventBus,
  type PlatformEventStore,
  type PlatformEvent,
} from "@nzila/platform-event-fabric";
import { DEAL_ENGINE_EVENTS, type DealEngineEventType } from "@nzila/deal-engine/events";

// ── DB-backed event store ───────────────────────────────

function createDbEventStore(): PlatformEventStore {
  return {
    async persist(event: PlatformEvent): Promise<void> {
      try {
        await db.insert(dealEngineEvents).values({
          id: event.id,
          type: event.type,
          payload: event.payload as Record<string, unknown>,
          metadata: event.metadata as unknown as Record<string, unknown>,
          createdAt: new Date(event.createdAt),
        });
      } catch (err) {
        console.error("[EVENT-STORE] persist failed", { id: event.id, type: event.type }, err);
      }
    },

    async query(eventType: string, since: string, tenantId?: string): Promise<readonly PlatformEvent[]> {
      try {
        const sinceDate = new Date(since);
        const rows = await db.select().from(dealEngineEvents)
          .where(
            sql`${dealEngineEvents.type} = ${eventType} AND ${dealEngineEvents.createdAt} >= ${sinceDate}`,
          )
          .orderBy(dealEngineEvents.createdAt)
          .limit(500);

        return rows
          .map((r) => ({
            id: r.id,
            type: r.type,
            payload: r.payload as Record<string, unknown>,
            metadata: r.metadata as PlatformEvent["metadata"],
            createdAt: r.createdAt.toISOString(),
          }))
          .filter((e) => !tenantId || e.metadata.tenantId === tenantId);
      } catch (err) {
        console.error("[EVENT-STORE] query failed", { eventType, since }, err);
        return [];
      }
    },
  };
}

let _bus: PlatformEventBus | null = null;

function getBus(): PlatformEventBus {
  if (!_bus) {
    _bus = createPlatformEventBus({ store: createDbEventStore() });
  }
  return _bus;
}

// ── Idempotency guard ───────────────────────────────────

const IDEMPOTENCY_WINDOW_MS = 60_000; // 1 minute
const _seen = new Map<string, number>();

function isDuplicate(correlationId: string | undefined): boolean {
  if (!correlationId) return false;
  const now = Date.now();
  // Prune stale entries periodically
  if (_seen.size > 500) {
    for (const [key, ts] of _seen) {
      if (now - ts > IDEMPOTENCY_WINDOW_MS) _seen.delete(key);
    }
  }
  const lastSeen = _seen.get(correlationId);
  if (lastSeen && now - lastSeen < IDEMPOTENCY_WINDOW_MS) return true;
  _seen.set(correlationId, now);
  return false;
}

export interface EmitOptions {
  actorId: string;
  tenantId: string;
  source?: string;
  correlationId?: string;
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
    console.info("[EVENT] duplicate event dropped", { eventType, correlationId: opts.correlationId });
    return;
  }

  try {
    const bus = getBus();
    const event = buildPlatformEvent({
      type: eventType,
      payload,
      tenantId: opts.tenantId,
      actorId: opts.actorId,
      source: opts.source ?? "control-plane:deal-engine",
    });
    await bus.publish(event);
  } catch (err) {
    console.error("[EVENT] emitDealEvent failed", { eventType }, err);
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
  const bus = getBus();
  return bus.subscribe(eventType, handler);
}

/** Expose the event catalog for reference */
export { DEAL_ENGINE_EVENTS };
