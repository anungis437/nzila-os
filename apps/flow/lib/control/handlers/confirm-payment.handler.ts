/**
 * Flow — Confirm Payment Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { ConfirmPaymentCommand } from '@/lib/commands/types'
import { orderRepo, paymentRepo } from '@/lib/repositories'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const confirmPaymentHandler: CommandHandler<ConfirmPaymentCommand> = {
  commandType: 'confirm_payment',

  async execute(command, context): Promise<CommandResult> {
    const input = ConfirmPaymentCommand.parse(command)

    const payment = await paymentRepo.findById(input.payment_id, context.org_id)
    if (!payment) throw new EntityNotFoundError('payment', input.payment_id)

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    // Confirm payment
    await paymentRepo.update(input.payment_id, context.org_id, { status: 'paid' })

    // Recompute order payment state
    const totalPaid = await paymentRepo.totalPaidForOrder(input.order_id)
    const newPaymentStatus = totalPaid >= Number(order.total) ? 'PAID' : 'PARTIALLY_PAID'

    const orderPatch: Record<string, unknown> = { paymentStatus: newPaymentStatus }
    if (newPaymentStatus === 'PAID') {
      orderPatch.status = 'PAYMENT_COMPLETE'
    }
    await orderRepo.update(input.order_id, context.org_id, orderPatch)

    const eventIds: string[] = []

    eventIds.push(dispatchDomainEvent({
      type: 'payment_received',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'order',
      entity_id: input.order_id,
      correlation_id: context.correlation_id,
      metadata: { payment_id: input.payment_id, confirmed: true, total_paid: totalPaid },
    }))

    // If payment cleared, emit clear event
    if (newPaymentStatus === 'PAID') {
      eventIds.push(dispatchDomainEvent({
        type: 'order_ready_for_procurement',
        actor_id: input.actor_id,
        org_id: context.org_id,
        entity_type: 'order',
        entity_id: input.order_id,
        correlation_id: context.correlation_id,
      }))
    }

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'payment',
      entity_id: input.payment_id,
      action: 'payment_confirmed',
      status_after: 'confirmed',
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    return {
      success: true,
      entity_type: 'payment',
      entity_id: input.payment_id,
      status_after: newPaymentStatus,
      emitted_event_ids: eventIds,
      audit_ref: auditRef,
      message: 'Payment confirmed',
    }
  },
}
