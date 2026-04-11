// Types
export type {
  TransitionContext,
  Guard,
  GuardResolver,
  EmittedEvent,
  ScheduledAction,
  TransitionDef,
  MachineDefinition,
  TransitionSuccess,
  TransitionFailure,
  TransitionFailureCode,
  TransitionResult,
  TransitionRecord,
} from './types'

// Engine (pure functions)
export {
  attemptTransition,
  getAvailableTransitions,
  validateMachine,
} from './engine'

// Audited runner
export { executeTransition } from './audited'

// Registry
export {
  registerMachine,
  getMachine,
  listMachines,
  unregisterMachine,
  clearRegistry,
} from './registry'

// Builders
export {
  TransitionBuilder,
  transition,
  MachineBuilder,
  machine,
} from './builders'
