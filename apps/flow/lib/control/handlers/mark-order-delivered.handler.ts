/**
 * Flow — Mark Order Delivered Handler
 *
 * Transitions an order to delivered status.
 * Gated by invariant + workflow guards.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { MarkOrderDeliveredCommand } from '@/lib/commands/types'
import { orderRepo } from '@/lib/repositories'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const markOrderDeliveredHandler: CommandHandler<MarkOrderDeliveredCommand> = {
  commandType: 'mark_order_delivered',

  async execute(command, context): Promise<CommandResult> {
    const input = MarkOrderDeliveredCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    const wf = validateTransition('order', order.status, 'DELIVERED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot mark order delivered from status ${order.status}` }] }
    }

    const statusBefore = order.status
    await orderRepo.update(input.order_id, context.org_id, { status: 'delivered' })

    const eventId = dispatchDomainEvent({
      type: 'order_delivered',
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
      action: 'order_delivered',
      status_before: statusBefore,
      status_after: 'DELIVERED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'order',
      entity_id: input.order_id,
      status_after: 'DELIVERED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Order marked as delivered',
    }
  },
}
