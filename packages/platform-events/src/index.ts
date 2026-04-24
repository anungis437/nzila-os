/**
 * @nzila/platform-events
 *
 * Canonical platform event bus for NzilaOS.
 * Provides unified event envelope, typed bus, persistence, and dispatch.
 *
 * @module @nzila/platform-events
 */
export type {
  PlatformEvent,
  PlatformEventMetadata,
  PlatformEventHandler,
  PlatformEventBusInterface,
  EventStorePorts,
  Unsubscribe,
  PlatformEventCategory,
} from './types'

export { PLATFORM_EVENT_CATEGORIES } from './types'

export {
  platformEventSchema,
  platformEventMetadataSchema,
  validateEvent,
  safeValidateEvent,
} from './schema'
export type { ValidatedPlatformEvent } from './schema'

export { PlatformEventBus, createPlatformEvent } from './bus'
export type { PlatformEventBusOptions } from './bus'

export { DrizzleEventStore, platformEvents } from './store'
export type { DrizzleEventStoreOptions } from './store'

export { PlatformEventDispatcher } from './dispatcher'
export type { DispatchResult, HandlerRegistration } from './dispatcher'

// Commercial GTM events
export {
  COMMERCIAL_EVENTS,
  createCommercialEvent,
  emitLeadCreated,
  emitTrialStarted,
  emitSubscriptionStarted,
  emitSubscriptionUpgraded,
  emitSubscriptionCancelled,
  emitDealWon,
} from './commercial'
export type {
  CommercialEventType,
  LeadCreatedPayload,
  DemoBookedPayload,
  TrialStartedPayload,
  TrialActivatedPayload,
  PilotStartedPayload,
  ProposalSentPayload,
  DealWonPayload,
  DealLostPayload,
  SubscriptionStartedPayload,
  SubscriptionUpgradedPayload,
  SubscriptionCancelledPayload,
  ExpansionClosedPayload,
} from './commercial'

export {
  sharedLeadCaptureSchema,
  sharedCrmEventSchema,
  sharedReferralAttributionSchema,
  sharedAnalyticsDashboardRowSchema,
  COMMERCIAL_ANALYTICS_EVENTS,
  SHARED_NOTIFICATION_CHANNELS,
} from './commercial-layer'
export type {
  SharedLeadCaptureInput,
  SharedCrmEventInput,
  SharedReferralAttribution,
  SharedAnalyticsDashboardRow,
  CommercialAnalyticsEventName,
  SharedNotificationChannel,
} from './commercial-layer'
