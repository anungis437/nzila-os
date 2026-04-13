// ─── @nzila/events ───────────────────────────────────────────────────────────
// Lightweight event bus with contract validation, persistence,
// and cross-app interoperability.

export {
  EventBus,
  type EventHandler,
} from './bus.js'

export {
  EventEmitter,
  emitEvent,
  setGlobalEmitter,
  getGlobalEmitter,
  type EventEmitterConfig,
} from './emitter.js'

export {
  type EventStore,
  InMemoryEventStore,
} from './store.js'

export {
  type DurableEventBus,
  type DurableEventBusOptions,
  type DurableSubscription,
} from './durable-bus.js'
