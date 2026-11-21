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
    const errorMsg = result.errors?.map((e) => e.message).join('; ') ?? 'Command failed'
    return { success: false, error: errorMsg }
  }

  return { success: true, data: result }
}

/** Existing pipeline, but outcome hooks run only after the app transaction
 * commits its case, canonical audit and source-derived notification. */
export async function executeModerationResolution(
  context: import('@/lib/resolve-org').OrganizationActionContext,
  command: import('./handlers/resolve-moderation-case.handler').ResolveModerationCaseCommand,
) {
  const { bindModerationContext } = await import('./scoped-command-context')
  const { afterCommandSuccess } = await import('./control-plane-bridge')
  const bound = bindModerationContext(context)
  if (command.actor_id !== context.actorId)
    throw new Error('Authenticated moderation actor changed')
  const result = await execute(command, bound)
  if (!result.success)
    throw new Error(result.errors?.map((e) => e.message).join('; ') ?? 'Moderation command failed')
  return { result, afterCommit: () => afterCommandSuccess(bound, result) }
}
