/**
 * @nzila/platform-integrations — barrel export
 */
export {
  type ConnectorAdapter,
  type ConnectionTestResult,
  type ConnectorExecutionResult,
  type ConnectionStore,
  ConnectorRegistry,
  connectorRegistry,
} from './connector-registry'

export {
  type RunStore,
  type IntegrationEventEmitter,
  type ExecutionContext,
  IntegrationExecutionEngine,
} from './execution-engine'

export { MappingEngine } from './mapping-engine'

export {
  type DeliveryAttemptStore,
  type DeadLetterStore,
  type SubscriptionStore,
  type WebhookFetchPort,
  WebhookEngine,
} from './webhook-engine'

export {
  type IdentityLinkStore,
  IdentityLinker,
} from './identity-linker'

export {
  type SyncSessionStore,
  type SyncCursorStore,
  type SyncPolicyStore,
  type SyncRecordDelta,
  type SyncResult,
  SyncEngine,
} from './sync-engine'

export {
  type IntegrationAuditHooks,
  DefaultIntegrationAuditHooks,
  NoopIntegrationAuditHooks,
} from './audit-hooks'

export {
  type IdempotencyStore,
  InMemoryIdempotencyStore,
} from './idempotency'

export { computeHmacSignature, verifyHmacSignature } from './signature'

export {
  type RateLimitConfig,
  type RateLimitResult,
  InMemoryRateLimiter,
} from './rate-limiter'
