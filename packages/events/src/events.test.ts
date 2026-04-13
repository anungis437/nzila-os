import { describe, it, expect, vi } from "vitest";
import { EventBus } from "./bus.js";
import { EventEmitter, emitEvent, getGlobalEmitter, setGlobalEmitter } from "./emitter.js";
import { InMemoryEventStore } from "./store.js";
import { AzureServiceBusAdapter } from "./adapters/azure-service-bus.js";

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
  it("emit aggregates handler errors", async () => {
    const bus = new EventBus();

    bus.on("bad", () => {
      throw new Error("first");
    });
    bus.on("bad", () => {
      throw "second";
    });

    await expect(bus.emit(makeEvent("bad"))).rejects.toThrow(
      "Event handler errors (2): first; second",
    );
  });

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

  it("emitSafe counts successful specific and wildcard deliveries", async () => {
    const bus = new EventBus();
    const specific = vi.fn();
    const wildcard = vi.fn();

    bus.on("ok", specific);
    bus.onAny(wildcard);

    const result = await bus.emitSafe(makeEvent("ok"));

    expect(result.errors).toHaveLength(0);
    expect(result.delivered).toBe(2);
    expect(specific).toHaveBeenCalledTimes(1);
    expect(wildcard).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe removes handler", async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on("test", handler);

    unsub();
    await bus.emit(makeEvent("test"));

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe callbacks are idempotent for specific and wildcard handlers", async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const anyHandler = vi.fn();
    const unsub = bus.on("test", handler);
    const unsubAny = bus.onAny(anyHandler);

    unsub();
    unsub();
    unsubAny();
    unsubAny();

    const result = await bus.emitSafe(makeEvent("test"));
    expect(result.delivered).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("hasHandlers reflects specific and wildcard registrations", () => {
    const bus = new EventBus();
    expect(bus.hasHandlers("x")).toBe(false);

    const unsub = bus.on("x", vi.fn());
    expect(bus.hasHandlers("x")).toBe(true);
    unsub();
    expect(bus.hasHandlers("x")).toBe(false);

    const unsubAny = bus.onAny(vi.fn());
    expect(bus.hasHandlers("anything")).toBe(true);
    unsubAny();
    expect(bus.hasHandlers("anything")).toBe(false);
  });

  it("clear removes all subscriptions", async () => {
    const bus = new EventBus();
    const specific = vi.fn();
    const any = vi.fn();
    bus.on("x", specific);
    bus.onAny(any);

    bus.clear();
    await bus.emit(makeEvent("x"));

    expect(specific).not.toHaveBeenCalled();
    expect(any).not.toHaveBeenCalled();
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

  it("supports correlation queries and limit", async () => {
    const store = new InMemoryEventStore();
    const c1 = crypto.randomUUID();

    await store.save(makeEvent("a", {}, { metadata: { orgId: "t1", actorId: "a1", source: "test", correlationId: c1 } }));
    await store.save(makeEvent("a", {}, { metadata: { orgId: "t1", actorId: "a1", source: "test", correlationId: c1 } }));
    await store.save(makeEvent("a", {}, { metadata: { orgId: "t1", actorId: "a1", source: "test", correlationId: crypto.randomUUID() } }));

    const byCorrelation = await store.getByCorrelation(c1);
    expect(byCorrelation).toHaveLength(2);

    const limited = await store.getByType("a", { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it("freezes stored event copies", async () => {
    const store = new InMemoryEventStore();
    const event = makeEvent("frozen");
    await store.save(event);

    const saved = store.getAll()[0] as Record<string, unknown>;
    expect(Object.isFrozen(saved)).toBe(true);
  });
});

describe("EventEmitter", () => {
  it("emits through bus and persists through store when validation disabled", async () => {
    const bus = new EventBus();
    const store = new InMemoryEventStore();
    const received = vi.fn();
    bus.on("test.event", received);

    const emitter = new EventEmitter({
      bus,
      store,
      source: "test-suite",
      validateContracts: false,
    });

    const event = await emitter.emitEvent(
      "test.event",
      { ok: true },
      { orgId: "org-1", actorId: "user-1", correlationId: crypto.randomUUID() },
      2,
    );

    expect(event.type).toBe("test.event");
    expect(event.version).toBe(2);
    expect(event.metadata.source).toBe("test-suite");
    expect(received).toHaveBeenCalledTimes(1);

    const stored = await store.getByType("test.event");
    expect(stored).toHaveLength(1);
  });

  it("validates contracts by default and rejects invalid payloads", async () => {
    vi.resetModules();
    vi.doMock("@nzila/contracts", async () => {
      const actual = await vi.importActual<typeof import("@nzila/contracts")>("@nzila/contracts");
      return {
        ...actual,
        getContractRegistry: () => ({
          validate: () => ({ valid: false, errors: ["payload is invalid"] }),
        }),
      };
    });

    try {
      const { EventEmitter: MockedEventEmitter } = await import("./emitter.js");
      const emitter = new MockedEventEmitter({
        bus: new EventBus(),
        source: "contracts",
      });

      await expect(
        emitter.emitEvent("contract.test", { bad: true }, { orgId: "org-1", actorId: "user-1" }),
      ).rejects.toThrow("Contract violation for contract.test v1: payload is invalid");
    } finally {
      vi.doUnmock("@nzila/contracts");
      vi.resetModules();
    }
  });

  it("emits successfully when contract validation passes with default settings", async () => {
    vi.resetModules();
    vi.doMock("@nzila/contracts", async () => {
      const actual = await vi.importActual<typeof import("@nzila/contracts")>("@nzila/contracts");
      return {
        ...actual,
        getContractRegistry: () => ({
          validate: () => ({ valid: true, errors: [] }),
        }),
      };
    });

    try {
      const { EventEmitter: MockedEventEmitter } = await import("./emitter.js");
      const handler = vi.fn();
      const bus = new EventBus();
      bus.on("contract.valid", handler);

      const emitter = new MockedEventEmitter({
        bus,
        source: "contracts",
      });

      const event = await emitter.emitEvent(
        "contract.valid",
        { ok: true },
        { orgId: "org-1", actorId: "user-1" },
      );

      expect(event.type).toBe("contract.valid");
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock("@nzila/contracts");
      vi.resetModules();
    }
  });

  it("throws when global emitter is not configured", async () => {
    vi.resetModules();
    const mod = await import("./emitter.js");
    expect(() => mod.getGlobalEmitter()).toThrow("Global EventEmitter not configured");
  });

  it("uses global emitter via emitEvent helper", async () => {
    const bus = new EventBus();
    const emitter = new EventEmitter({ bus, source: "global", validateContracts: false });
    setGlobalEmitter(emitter);

    const event = await emitEvent(
      "global.event",
      { value: 1 },
      { orgId: "org-2", actorId: "user-2", correlationId: crypto.randomUUID() },
    );

    expect(event.type).toBe("global.event");
    expect(event.metadata.source).toBe("global");
  });

  it("returns the configured global emitter", () => {
    const emitter = new EventEmitter({ bus: new EventBus(), source: "configured", validateContracts: false });
    setGlobalEmitter(emitter);

    expect(getGlobalEmitter()).toBe(emitter);
  });
});

describe("durable adapter stubs", () => {
  it("AzureServiceBusAdapter exposes stubbed publish and subscription methods", async () => {
    const adapter = new AzureServiceBusAdapter({
      connectionString: "Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=secret",
      topicName: "nzila-events",
      maxDeliveryAttempts: 7,
      visibilityTimeoutSeconds: 45,
    });

    await expect(adapter.publish(makeEvent("bus.publish"))).rejects.toThrow(
      "AzureServiceBusAdapter.publish() not yet implemented",
    );
    await expect(adapter.subscribe("bus.publish", vi.fn())).rejects.toThrow(
      "AzureServiceBusAdapter.subscribe() not yet implemented.",
    );
    await expect(adapter.subscribeAll(vi.fn())).rejects.toThrow(
      "AzureServiceBusAdapter.subscribeAll() not yet implemented.",
    );
  });

  it("AzureServiceBusAdapter.close is a no-op stub", async () => {
    const adapter = new AzureServiceBusAdapter({
      connectionString: "Endpoint=sb://example.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=secret",
      topicName: "nzila-events",
      subscriptionName: "tests",
    });

    await expect(adapter.close()).resolves.toBeUndefined();
  });
});

describe("package index", () => {
  it("exports core event symbols", async () => {
    const api = await import("./index.js");
    expect(typeof api.EventBus).toBe("function");
    expect(typeof api.EventEmitter).toBe("function");
    expect(typeof api.InMemoryEventStore).toBe("function");
    expect(typeof api.getGlobalEmitter).toBe("function");
  });
});
