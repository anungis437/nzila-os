/**
 * Flow — Void Invoice Handler
 *
 * Voids an invoice, preventing further payment collection.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { VoidInvoiceCommand } from '@/lib/commands/types'
import { invoiceRepo } from '@/lib/repositories'
import { invoiceCanBeVoided } from '@/domain/invariants'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const voidInvoiceHandler: CommandHandler<VoidInvoiceCommand> = {
  commandType: 'void_invoice',

  async execute(command, context): Promise<CommandResult> {
    const input = VoidInvoiceCommand.parse(command)

    const invoice = await invoiceRepo.findById(input.invoice_id, context.org_id)
    if (!invoice) throw new EntityNotFoundError('invoice', input.invoice_id)

    const currentStatus = (invoice.status ?? '').toUpperCase()
    const domainCheck = invoiceCanBeVoided({ status: currentStatus as 'DRAFT' })
    if (!domainCheck.valid) {
      return { success: false, errors: [{ code: 'DOMAIN_INVARIANT', message: domainCheck.violations.join('; ') }] }
    }

    await invoiceRepo.update(input.invoice_id, { status: 'void' })

    const eventId = dispatchDomainEvent({
      type: 'invoice_voided',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: currentStatus, reason: input.reason },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      action: 'invoice_voided',
      status_before: currentStatus,
      status_after: 'VOID',
      correlation_id: context.correlation_id,
      metadata: { reason: input.reason },
    })

    return {
      success: true,
      entity_type: 'invoice',
      entity_id: input.invoice_id,
      status_after: 'VOID',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Invoice voided',
    }
  },
}
