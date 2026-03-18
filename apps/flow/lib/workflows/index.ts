/**
 * Flow — Workflow State Machines
 *
 * Barrel export for all Flow workflow engines.
 * Each workflow exposes: validateTransition, attemptTransition, applyTransition.
 */

// Types & Errors
export { InvalidTransitionError } from './types'
export type { Transition, TransitionResult } from './types'
export {
  FlowWorkflowError,
  InvalidWorkflowTransitionError,
  MissingWorkflowPrerequisiteError,
  PaymentGateBlockedError,
  WorkflowInvariantError,
  EntityNotFoundError,
} from './errors'

// Quote workflow (existing, refactored)
export {
  attemptQuoteTransition,
  getAvailableQuoteTransitions,
  isQuoteTransitionAllowed,
  getAllQuoteStatuses,
} from './quote-state-machine'

// Order workflow (PRIMARY)
export {
  validateOrderTransition,
  attemptOrderTransition,
  applyOrderTransition,
  getAvailableOrderTransitions,
  getAllOrderStatuses,
} from './order-workflow'

// Purchase Order workflow
export {
  validatePOTransition,
  attemptPOTransition,
  applyPOTransition,
  getAvailablePOTransitions,
} from './po-workflow'

// Production workflow
export {
  validateProductionTransition,
  attemptProductionTransition,
  applyProductionTransition,
  getAvailableProductionTransitions,
} from './production-workflow'

// Shipment workflow
export {
  validateShipmentTransition,
  attemptShipmentTransition,
  applyShipmentTransition,
  getAvailableShipmentTransitions,
} from './shipment-state-machine'
