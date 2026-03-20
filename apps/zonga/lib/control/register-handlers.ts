/**
 * Zonga — Handler Registry
 *
 * Registers all command handlers with the command bus.
 * Import this module once at app startup to activate the control layer.
 */
import { registerHandler } from './command-bus'

// Creator handlers
import { registerCreatorHandler } from './handlers/register-creator.handler'

// Release handlers
import { createReleaseHandler } from './handlers/create-release.handler'
import { transitionReleaseStatusHandler } from './handlers/transition-release-status.handler'

// Moderation handlers
import { createModerationCaseHandler } from './handlers/create-moderation-case.handler'
import { resolveModerationCaseHandler } from './handlers/resolve-moderation-case.handler'

// Payout handlers
import { executePayoutHandler } from './handlers/execute-payout.handler'

// ── Registration ───────────────────────────────────────────────────────────

const handlers = [
  registerCreatorHandler,
  createReleaseHandler,
  transitionReleaseStatusHandler,
  createModerationCaseHandler,
  resolveModerationCaseHandler,
  executePayoutHandler,
]

for (const handler of handlers) {
  registerHandler(handler as never)
}

export { handlers }
