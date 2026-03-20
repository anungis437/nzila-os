/**
 * Zonga — Command Bus
 *
 * Central execution pipeline for all critical business mutations.
 * Enforces the canonical lifecycle:
 *
 * 1. Validate command input (Zod)
 * 2. Load domain state
 * 3. Persist domain mutation
 * 4. Write audit metadata
 * 5. Return structured CommandResult
 */
import type { CommandContext, CommandResult, CommandHandler } from './types'
import { logger } from '@/lib/logger'

const registry = new Map<string, CommandHandler<unknown>>()

export function registerHandler<T>(handler: CommandHandler<T>): void {
  if (registry.has(handler.commandType)) {
    throw new Error(`Handler already registered for command type: ${handler.commandType}`)
  }
  registry.set(handler.commandType, handler as CommandHandler<unknown>)
}

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
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Command bus: unhandled error', {
      commandType: command.type,
      error: message,
    })
    return {
      success: false,
      errors: [{
        code: 'COMMAND_EXECUTION_FAILED',
        message,
      }],
    }
  }
}
