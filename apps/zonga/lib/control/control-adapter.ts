/**
 * Zonga — Control Adapter
 *
 * Bridges Next.js server actions to the command bus.
 * Server actions import this to dispatch commands through the control layer.
 */
import { execute } from './command-bus'
import type { CommandContext, CommandResult } from './types'
import { resolveOrgContext } from '@/lib/resolve-org'
import { randomUUID } from 'node:crypto'

export type { CommandResult }

export interface ActionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export async function executeCommand<T extends { type: string }>(
  command: T,
  overrides?: Partial<CommandContext>,
): Promise<ActionResult<CommandResult>> {
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
