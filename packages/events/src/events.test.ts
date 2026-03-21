import { describe, it, expect, vi } from "vitest";
import { EventBus } from "./bus.js";
import { InMemoryEventStore } from "./store.js";

function makeEvent(type: string, payload: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    type,
    version: 1,
    timestamp: new Date().toISOString(),
    metadata: { orgId: "t1", actorId: "a1", source: "test" },
    payload,
    ...overrides,
  };
}

describe("EventBus", () => {
  it("emits events to typed handlers", async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("order.created", handler);
    await bus.emit(makeEvent("order.created", { orderId: "o1" }));

    expect(handler).toHaveBeenCalledTimes(1);
    const receivedEvent = handler.mock.calls[0]![0];
    expect(receivedEvent.payload).toEqual({ orderId: "o1" });
  });

  it("supports multiple handlers per event type", async () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("order.created", h1);
    bus.on("order.created", h2);
    await bus.emit(makeEvent("order.created", { orderId: "o1" }));

    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it("onAny receives all events", async () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.onAny(handler);
    await bus.emit(makeEvent("a", { x: 1 }));
    await bus.emit(makeEvent("b", { y: 2 }));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("emitSafe isolates handler errors", async () => {
    const bus = new EventBus();
    bus.on("fail", () => {
      throw new Error("handler error");
    });

    const result = await bus.emitSafe(makeEvent("fail"));
    expect(result.errors).toHaveLength(1);
    expect(result.delivered).toBe(0);
  });

  it("unsubscribe removes handler", async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on("test", handler);

    unsub();
    await bus.emit(makeEvent("test"));

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("InMemoryEventStore", () => {
  it("stores and retrieves events by type", async () => {
    const store = new InMemoryEventStore();
    await store.save(makeEvent("order.created", { orderId: "o1" }));

    const events = await store.getByType("order.created");
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toEqual({ orderId: "o1" });
  });

  it("retrieves events by org", async () => {
    const store = new InMemoryEventStore();
    await store.save(makeEvent("a", {}, { metadata: { orgId: "t1", actorId: "a1", source: "test" } }));
    await store.save(makeEvent("b", {}, { metadata: { orgId: "t2", actorId: "a2", source: "test" } }));

    const t1Events = await store.getByOrg("t1");
    const t2Events = await store.getByOrg("t2");
    expect(t1Events).toHaveLength(1);
    expect(t2Events).toHaveLength(1);
  });
});
