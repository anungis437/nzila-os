/**
 * Flow — Issue Invoice Handler
 *
 * Transitions invoice from DRAFT → SENT, enforcing state machine.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { IssueInvoiceCommand } from '@/lib/commands/types'
import { invoiceRepo } from '@/lib/repositories'
import { invoiceCanBeIssued } from '@/domain/invariants'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const issueInvoiceHandler: CommandHandler<IssueInvoiceCommand> = {
  commandType: 'issue_invoice',

  async execute(command, context): Promise<CommandResult> {
    const input = IssueInvoiceCommand.parse(command)

    const invoice = await invoiceRepo.findById(input.invoice_id, context.org_id)
    if (!invoice) throw new EntityNotFoundError('invoice', input.invoice_id)

    const currentStatus = (invoice.status ?? 'draft').toUpperCase()
    const domainCheck = invoiceCanBeIssued({ status: currentStatus as 'DRAFT', amount: Number(invoice.total ?? 0) })
    if (!domainCheck.valid) {
      return { success: false, errors: [{ code: 'DOMAIN_INVARIANT', message: domainCheck.violations.join('; ') }] }
    }

    await invoiceRepo.update(input.invoice_id, context.org_id, { status: 'sent' })

    const eventId = dispatchDomainEvent({
      type: 'invoice_issued',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: currentStatus },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      action: 'invoice_issued',
      status_before: currentStatus,
      status_after: 'SENT',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      status_after: 'SENT',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Invoice issued',
    }
  },
}
