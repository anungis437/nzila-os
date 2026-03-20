/**
 * Zonga — Control Layer Public API
 *
 * Import this barrel to activate the control layer and get access to
 * the command execution functions.
 */

// Register all handlers (side-effect import)
import './register-handlers'

// Re-export the execution primitives
export { executeCommand } from './control-adapter'
export type { ActionResult } from './control-adapter'
export type { CommandContext, CommandResult, CommandHandler, CommandError } from './types'

// Control plane bridge
export {
  gatePayout,
  enforceEconomics,
  validateGovernance,
  executeAdminOp,
  runInvariantCheck,
  afterCommandSuccess,
  emitCommandEvent,
  toControlPlaneContext,
} from './control-plane-bridge'
