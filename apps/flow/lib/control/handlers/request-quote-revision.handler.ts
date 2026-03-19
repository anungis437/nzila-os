/**
 * Flow — Request Quote Revision Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { RequestQuoteRevisionCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { revisionRepo } from '@/lib/repositories/workflow-repository'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'
import { randomUUID } from 'node:crypto'

export const requestQuoteRevisionHandler: CommandHandler<RequestQuoteRevisionCommand> = {
  commandType: 'request_quote_revision',

  async execute(command, context): Promise<CommandResult> {
    const input = RequestQuoteRevisionCommand.parse(command)

    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    const wf = validateTransition('quote', quote.status, 'REVISION_REQUESTED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot request revision from status ${quote.status}` }] }
    }

    const statusBefore = quote.status
    await quoteRepo.update(input.quote_id, context.org_id, { status: 'revised' })

    // Record revision
    await revisionRepo.save({
      id: randomUUID(),
      quoteId: input.quote_id,
      requestedBy: input.actor_id,
      requestMessage: input.request_message,
      status: 'OPEN',
      createdAt: new Date(),
    })

    const eventId = dispatchDomainEvent({
      type: 'quote_revision_requested',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { request_message: input.request_message, from_status: statusBefore },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      action: 'quote_revision_requested',
      status_before: statusBefore,
      status_after: 'REVISION_REQUESTED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'REVISION_REQUESTED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Quote revision requested',
    }
  },
}
