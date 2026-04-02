/**
 * Flow — Command Bus
 *
 * Central execution pipeline for all critical business mutations.
 * Enforces the canonical lifecycle:
 *
 * 1. Validate command input (Zod)
 * 2. Load domain state
 * 3. Run invariant checks
 * 4. Run workflow validation
 * 5. Run payment/production/shipment guards
 * 6. Persist domain mutation
 * 7. Emit persisted domain events
 * 8. Write audit metadata
 * 9. Dispatch external side effects
 * 10. Return structured CommandResult
 */
import type { CommandContext, CommandResult, CommandHandler } from './types'
import { logger } from '@/lib/logger'
import { FlowWorkflowError } from '@/lib/workflows/errors'

// ── Handler Registry ───────────────────────────────────────────────────────
// ga-check:exempt — command handler registry, not data persistence
const registry = new Map<string, CommandHandler<unknown>>()

export function registerHandler<T>(handler: CommandHandler<T>): void {
  if (registry.has(handler.commandType)) {
    throw new Error(`Handler already registered for command type: ${handler.commandType}`)
  }
  registry.set(handler.commandType, handler as CommandHandler<unknown>)
}

// ── Execute ────────────────────────────────────────────────────────────────

export async function execute<T extends { type: string }>(
  command: T,
  context: CommandContext,
): Promise<CommandResult> {
  const handler = registry.get(command.type)

  if (!handler) {
    logger.error('No handler for command type', { commandType: command.type })
    return {
      success: false,
      errors: [{
        code: 'UNKNOWN_COMMAND',
        message: `No handler registered for command type: ${command.type}`,
      }],
    }
  }

  logger.info('Command bus: executing', {
    commandType: command.type,
    orgId: context.org_id,
    actorId: context.actor_id,
    correlationId: context.correlation_id,
  })

  try {
    const result = await handler.execute(command, context)

    logger.info('Command bus: completed', {
      commandType: command.type,
      success: result.success,
      entityType: result.entity_type,
      entityId: result.entity_id,
      statusAfter: result.status_after,
    })

    return result
  } catch (err: unknown) {
    if (err instanceof FlowWorkflowError) {
      logger.warn('Command bus: workflow error', {
        commandType: command.type,
        errorCode: err.code,
        message: err.message,
      })
      return {
        success: false,
        errors: [{
          code: err.code,
          message: err.message,
        }],
      }
    }

    const message = err instanceof Error ? err.message : String(err)
    logger.error('Command bus: unexpected error', {
      commandType: command.type,
      error: message,
    })

    return {
      success: false,
      errors: [{
        code: 'INTERNAL_ERROR',
        message,
      }],
    }
  }
}

// ── Introspection ──────────────────────────────────────────────────────────

export function getRegisteredCommandTypes(): string[] {
  return Array.from(registry.keys())
}
