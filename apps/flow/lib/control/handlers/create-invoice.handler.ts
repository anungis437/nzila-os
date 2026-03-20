/**
 * Flow — Create Invoice Handler
 *
 * Creates an invoice from an order, enforcing order state and payment invariants.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CreateInvoiceCommand } from '@/lib/commands/types'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { orderRepo, invoiceRepo } from '@/lib/repositories'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const createInvoiceHandler: CommandHandler<CreateInvoiceCommand> = {
  commandType: 'create_invoice',

  async execute(command, context): Promise<CommandResult> {
    const input = CreateInvoiceCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    const orderStatus = (order.status ?? '').toUpperCase()
    if (orderStatus === 'CANCELLED') {
      return { success: false, errors: [{ code: 'INVALID_STATE', message: 'Cannot create invoice for a cancelled order' }] }
    }

    const invoiceId = randomUUID()
    const amount = Number(order.total ?? 0)

    await invoiceRepo.create({
      id: invoiceId,
      orgId: context.org_id,
      orderId: input.order_id,
      customerId: order.customerId,
      status: 'draft',
      amount: String(amount),
      currency: order.currency ?? 'CAD',
      dueDate: input.due_date,
      createdBy: input.actor_id,
    })

    const eventId = dispatchDomainEvent({
      type: 'invoice_created',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'invoice',
      entity_id: invoiceId,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id, amount },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'invoice',
      entity_id: invoiceId,
      action: 'invoice_created',
      status_after: 'DRAFT',
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    return {
      success: true,
      entity_type: 'invoice',
      entity_id: invoiceId,
      status_after: 'DRAFT',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Invoice created',
    }
  },
}
