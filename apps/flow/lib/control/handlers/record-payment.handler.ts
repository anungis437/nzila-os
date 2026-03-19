/**
 * Flow — Record Payment Handler
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { RecordPaymentCommand } from '@/lib/commands/types'
import { orderRepo, paymentRepo } from '@/lib/repositories'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const recordPaymentHandler: CommandHandler<RecordPaymentCommand> = {
  commandType: 'record_payment',

  async execute(command, context): Promise<CommandResult> {
    const input = RecordPaymentCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    // Record payment
    const paymentId = randomUUID()
    await paymentRepo.create({
      id: paymentId,
      orgId: context.org_id,
      orderId: input.order_id,
      amountPaid: String(input.amount),
      amountDue: order.total ?? '0',
      status: 'pending_deposit',
      provider: input.method,
      providerRef: input.reference ?? null,
      depositRequired: false,
      dueBeforeProduction: false,
    })

    // Compute new payment state
    const totalPaid = await paymentRepo.totalPaidForOrder(input.order_id)
    const newPaymentStatus = totalPaid >= Number(order.total) ? 'PAID' : 'PARTIALLY_PAID'

    // Update order payment status
    const orderStatusUpdate: Record<string, unknown> = { paymentStatus: newPaymentStatus }
    if (newPaymentStatus === 'PAID' && order.status === 'confirmed') {
      orderStatusUpdate.status = 'fulfillment'
    } else if (totalPaid > 0 && order.status === 'confirmed') {
      orderStatusUpdate.status = 'fulfillment'
    }
    await orderRepo.update(input.order_id, context.org_id, orderStatusUpdate)

    const eventId = dispatchDomainEvent({
      type: 'payment_received',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'order',
      entity_id: input.order_id,
      correlation_id: context.correlation_id,
      metadata: {
        payment_id: paymentId,
        amount: input.amount,
        method: input.method,
        total_paid: totalPaid,
        new_payment_status: newPaymentStatus,
      },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'payment',
      entity_id: paymentId,
      action: 'payment_recorded',
      status_after: newPaymentStatus,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id, amount: input.amount },
    })

    return {
      success: true,
      entity_type: 'payment',
      entity_id: paymentId,
      status_after: newPaymentStatus,
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: `Payment of ${input.amount} recorded`,
    }
  },
}
