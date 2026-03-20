/**
 * Flow — Submit for Review Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { SubmitForReviewCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const submitForReviewHandler: CommandHandler<SubmitForReviewCommand> = {
  commandType: 'submit_for_review',

  async execute(command, context): Promise<CommandResult> {
    const input = SubmitForReviewCommand.parse(command)

    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    const currentStatus = (quote.status ?? 'draft').toUpperCase()
    const wf = validateTransition('quote', currentStatus, 'INTERNAL_REVIEW')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot submit for review from ${currentStatus}` }] }
    }

    await quoteRepo.update(input.quote_id, { status: 'INTERNAL_REVIEW' })

    const eventId = dispatchDomainEvent({
      type: 'quote_submitted_for_review',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: currentStatus },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      action: 'quote_submitted_for_review',
      status_before: currentStatus,
      status_after: 'INTERNAL_REVIEW',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'INTERNAL_REVIEW',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Quote submitted for internal review',
    }
  },
}
