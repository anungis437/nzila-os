/**
 * Flow — Control Adapter
 *
 * Bridges Next.js server actions to the command bus.
 * Translates between the legacy ActionResult<T> shape and CommandResult.
 * Server actions import this to dispatch commands through the control layer.
 */
import { execute } from './command-bus'
import type { CommandContext, CommandResult } from './types'
import { resolveOrgContext } from '@/lib/resolve-org'
import { logger } from '@/lib/logger'
import { randomUUID } from 'node:crypto'

// Re-export for convenience
export type { CommandResult }

// Legacy action result shape used by existing UI components
export interface LegacyActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

/**
 * Execute a command through the control layer, returning a LegacyActionResult.
 * Use this in server actions that already return { ok, data?, error? }.
 */
export async function executeCommand<T extends { type: string }>(
  command: T,
  overrides?: Partial<CommandContext>,
): Promise<LegacyActionResult<CommandResult>> {
  const ctx = await resolveOrgContext()
  const context: CommandContext = {
    org_id: ctx.orgId,
    actor_id: ctx.actorId,
    correlation_id: randomUUID(),
    ...overrides,
  }

  const result = await execute(command, context)

  if (!result.success) {
    const errorMsg = result.errors?.map(e => e.message).join('; ') ?? 'Command failed'
    return { ok: false, error: errorMsg }
  }

  return { ok: true, data: result }
}

/**
 * Execute a command returning { success, data?, error? } shape.
 * Use this in server actions that return the newer ActionResult pattern.
 */
export async function executeCommandV2<T extends { type: string }>(
  command: T,
  overrides?: Partial<CommandContext>,
): Promise<{ success: boolean; data?: CommandResult; error?: string }> {
  const ctx = await resolveOrgContext()
  const context: CommandContext = {
    org_id: ctx.orgId,
    actor_id: ctx.actorId,
    correlation_id: randomUUID(),
    ...overrides,
  }

  const result = await execute(command, context)

  if (!result.success) {
    const errorMsg = result.errors?.map(e => e.message).join('; ') ?? 'Command failed'
    return { success: false, error: errorMsg }
  }

  return { success: true, data: result }
}

/**
 * Build a command context from the current request.
 * Handles org resolution and correlation ID generation.
 */
export async function buildContext(
  overrides?: Partial<CommandContext>,
): Promise<CommandContext> {
  const ctx = await resolveOrgContext()
  return {
    org_id: ctx.orgId,
    actor_id: ctx.actorId,
    correlation_id: randomUUID(),
    ...overrides,
  }
}
