/**
 * Flow — Complete Order Handler
 *
 * Transitions an order to completed status.
 * Gated by invariant + workflow guards.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CompleteOrderCommand } from '@/lib/commands/types'
import { orderRepo } from '@/lib/repositories'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const completeOrderHandler: CommandHandler<CompleteOrderCommand> = {
  commandType: 'complete_order',

  async execute(command, context): Promise<CommandResult> {
    const input = CompleteOrderCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    const wf = validateTransition('order', order.status, 'COMPLETED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot complete order from status ${order.status}` }] }
    }

    const statusBefore = order.status
    await orderRepo.update(input.order_id, context.org_id, { status: 'completed' })

    const eventId = dispatchDomainEvent({
      type: 'order_completed',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'order',
      entity_id: input.order_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: statusBefore },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'order',
      entity_id: input.order_id,
      action: 'order_completed',
      status_before: statusBefore,
      status_after: 'COMPLETED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'order',
      entity_id: input.order_id,
      status_after: 'COMPLETED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Order completed',
    }
  },
}
