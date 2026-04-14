/**
 * @nzila/platform-event-fabric — Barrel Export
 */

// Types
export type {
  PlatformEventType,
  PlatformEventMetadata,
  PlatformEvent,
  PlatformEventHandler,
  PlatformEventBus,
  PlatformEventStore,
  EventSchemaDefinition,
  Unsubscribe,
} from './types'

export {
  PlatformEventTypes,
  PlatformEventMetadataSchema,
  PlatformEventSchema,
} from './types'

// Bus
export {
  createPlatformEventBus,
  createInMemoryEventStore,
  type CreateEventBusOptions,
} from './bus'

// Registry
export {
  registerEventType,
  getEventSchema,
  validateEventPayload,
  listEventSchemas,
  resetEventSchemaRegistry,
} from './registry'

// Builders
export { buildPlatformEvent, type BuildEventInput } from './builders'

// Instrumented bus
export { createInstrumentedEventBus } from './instrumented-bus'

// Schema (Drizzle)
export { platformEvents, eventSubscriptions } from './schema'

// Analytics bridge
export {
  createAnalyticsBridge,
  createConsoleAnalyticsAdapter,
  createInMemoryAnalyticsAdapter,
  stripPII,
  defaultEventMapper,
} from './analytics-bridge'
export type {
  AnalyticsAdapter,
  AnalyticsEvent,
  AnalyticsBridgeConfig,
  EventMapper,
  InMemoryAnalyticsStore,
} from './analytics-bridge'
