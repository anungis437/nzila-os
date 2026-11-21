/** Only a live verified callback may bind this transaction to moderation. */
import { assertZongaContext, type OrganizationActionContext } from '@/lib/resolve-org'
import type { CommandContext } from './types'
const transactions = new WeakMap<CommandContext, OrganizationActionContext>()
export function bindModerationContext(context: OrganizationActionContext): CommandContext {
  assertZongaContext(context)
  const command = Object.freeze({
    org_id: context.orgId,
    actor_id: context.actorId,
    correlation_id: context.requestId,
  })
  transactions.set(command, context)
  return command
}
export function commandTransaction(context: CommandContext): OrganizationActionContext | undefined {
  const transaction = transactions.get(context)
  if (transaction) assertZongaContext(transaction)
  return transaction
}
