/**
 * Flow — Send Quote Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { SendQuoteCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { quoteCanBeSent } from '@/domain/invariants'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { dispatchSideEffect } from '@/lib/control/dispatch/side-effect-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const sendQuoteHandler: CommandHandler<SendQuoteCommand> = {
  commandType: 'send_quote',

  async execute(command, context): Promise<CommandResult> {
    const input = SendQuoteCommand.parse(command)

    // 1. Invariant (DB-level: entity exists, customer exists)
    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    // 2. Load
    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    // 2b. Domain invariant (pure predicate)
    const lines = await quoteRepo.findLines(input.quote_id)
    const lineCount = lines.length
    const domainCheck = quoteCanBeSent(
      { customer_id: quote.customerId, valid_until: quote.validUntil ? new Date(quote.validUntil) : null, total_amount: Number(quote.total ?? 0) },
      lineCount,
    )
    if (!domainCheck.valid) {
      return { success: false, errors: [{ code: 'DOMAIN_INVARIANT', message: domainCheck.violations.join('; ') }] }
    }

    // 3. Workflow
    const wf = validateTransition('quote', quote.status, 'SENT_TO_CLIENT')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot transition from ${quote.status} to SENT_TO_CLIENT` }] }
    }

    // 4. Persist
    const statusBefore = quote.status
    await quoteRepo.update(input.quote_id, context.org_id, { status: 'sent' })

    // 5. Event
    const eventId = dispatchDomainEvent({
      type: 'quote_sent',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: statusBefore },
    })

    // 6. Audit
    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      action: 'quote_sent',
      status_before: statusBefore,
      status_after: 'SENT_TO_CLIENT',
      correlation_id: context.correlation_id,
    })

    // Side effects happen after authoritative state mutation + event + audit.
    await dispatchSideEffect({
      type: 'customer_notification',
      entity_type: 'quote',
      entity_id: input.quote_id,
      org_id: context.org_id,
      payload: {
        channel: 'email',
        template: 'quote_sent',
      },
      metadata: {
        correlation_id: context.correlation_id,
        actor_id: input.actor_id,
      },
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'SENT_TO_CLIENT',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Quote sent to client',
    }
  },
}
