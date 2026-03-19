/**
 * Flow — Control Layer
 *
 * Public API for the command-driven control layer.
 * Import from '@/lib/control' to access the command bus and types.
 *
 * IMPORTANT: Import './register-handlers' at app startup to wire handlers.
 */

// Command bus
export { execute, getRegisteredCommandTypes } from './command-bus'

// Types
export type {
  CommandContext,
  CommandResult,
  CommandError,
  CommandHandler,
  InvariantCheckResult,
  WorkflowCheckResult,
  PaymentGateCheckResult,
  PaymentGateState,
  ProductionGateCheckResult,
  ShipmentGateCheckResult,
} from './types'

// Guards
export { checkEntityExists, checkQuoteInvariants, checkOrderInvariants } from './guards/invariant-guard'
export { validateTransition, getAvailableTransitions } from './guards/workflow-guard'
export { checkCanGeneratePO, checkCanStartProduction, checkCanShipOrder } from './guards/payment-guard'
export { checkProductionReadiness } from './guards/production-guard'
export { checkShipmentReadiness, checkCanMarkShipped, checkCanMarkDelivered } from './guards/shipment-guard'

// Dispatchers
export { dispatchDomainEvent, dispatchMultipleEvents } from './dispatch/event-dispatcher'
export { dispatchAuditEntry } from './dispatch/audit-dispatcher'
export { dispatchSideEffect, registerSideEffectHandler } from './dispatch/side-effect-dispatcher'

// Errors
export { InvalidTransitionError } from './errors/invalid-transition-error'
export { PaymentGateBlockedError } from './errors/payment-gate-blocked-error'
export { InvariantViolationError } from './errors/invariant-violation-error'
export { EntityNotFoundError } from './errors/entity-not-found-error'
export { PermissionDeniedError } from './errors/permission-denied-error'
export { IntegrationDispatchError } from './errors/integration-dispatch-error'
