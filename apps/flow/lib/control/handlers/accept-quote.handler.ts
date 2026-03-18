/**
 * Flow — Accept Quote Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { AcceptQuoteCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const acceptQuoteHandler: CommandHandler<AcceptQuoteCommand> = {
  commandType: 'accept_quote',

  async execute(command, context): Promise<CommandResult> {
    const input = AcceptQuoteCommand.parse(command)

    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    const wf = validateTransition('quote', quote.status, 'ACCEPTED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot accept quote from status ${quote.status}` }] }
    }

    const statusBefore = quote.status
    await quoteRepo.update(input.quote_id, context.org_id, { status: 'accepted' })

    const eventId = dispatchDomainEvent({
      type: 'quote_accepted',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { customer_name: input.customer_name, from_status: statusBefore },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      action: 'quote_accepted',
      status_before: statusBefore,
      status_after: 'ACCEPTED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'ACCEPTED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Quote accepted',
    }
  },
}
