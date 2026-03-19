// ─── @nzila/contracts ────────────────────────────────────────────────────────
// Versioned domain event contracts with Zod schemas, contract registry,
// and runtime validation for cross-app interoperability.

export {
  type DomainEvent,
  type EventMetadata,
  type EventType,
  domainEventSchema,
  eventMetadataSchema,
  EVENT_CONTRACTS,
  // Domain events
  ClaimCreated_v1,
  ClaimUpdated_v1,
  ClaimResolved_v1,
  UserAssigned_v1,
  UserDeactivated_v1,
  OrderCreated_v1,
  PaymentProcessed_v1,
  PolicyEvaluated_v1,
  AIRequestCompleted_v1,
} from './domain.js'

export {
  ContractRegistry,
  createDefaultRegistry,
  getContractRegistry,
  setContractRegistry,
  validateEventPayload,
  type ContractEntry,
} from './registry.js'

export {
  validateDomainEvent,
  parseDomainEvent,
  safeParseDomainEvent,
} from './validators.js'
