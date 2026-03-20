/**
 * Flow — Check Production Readiness Handler
 *
 * Checks if all POs for an order are fully received.
 * If so, transitions the order to fulfillment status (production ready).
 * Replaces the direct DB mutation that was in workflow-triggers.ts.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CheckProductionReadinessCommand } from '@/lib/commands/types'
import { orderRepo, purchaseOrderRepo } from '@/lib/repositories'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const checkProductionReadinessHandler: CommandHandler<CheckProductionReadinessCommand> = {
  commandType: 'check_production_readiness',

  async execute(command, context): Promise<CommandResult> {
    const input = CheckProductionReadinessCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    // Get all POs linked to this order
    const pos = await purchaseOrderRepo.findByOrder(input.order_id, context.org_id)

    if (pos.length === 0) {
      return {
        success: true,
        entity_type: 'order',
        entity_id: input.order_id,
        status_after: order.status,
        message: 'No purchase orders found for this order.',
        warnings: ['No POs linked to this order.'],
      }
    }

    const receivedPOs = pos.filter((po) => po.status === 'received').length
    const allReceived = receivedPOs === pos.length
    const terminalStatuses = ['fulfillment', 'shipped', 'delivered', 'completed']

    if (allReceived && !terminalStatuses.includes(order.status)) {
      const statusBefore = order.status
      await orderRepo.update(input.order_id, context.org_id, { status: 'fulfillment' })

      const eventId = dispatchDomainEvent({
        type: 'production_readiness_achieved',
        actor_id: input.actor_id,
        org_id: context.org_id,
        entity_type: 'order',
        entity_id: input.order_id,
        correlation_id: context.correlation_id,
        metadata: { from_status: statusBefore, total_pos: pos.length, received_pos: receivedPOs },
      })

      const auditRef = await dispatchAuditEntry({
        org_id: context.org_id,
        actor_id: input.actor_id,
        entity_type: 'order',
        entity_id: input.order_id,
        action: 'production_readiness_achieved',
        status_before: statusBefore,
        status_after: 'FULFILLMENT',
        correlation_id: context.correlation_id,
        metadata: { total_pos: pos.length },
      })

      return {
        success: true,
        entity_type: 'order',
        entity_id: input.order_id,
        status_after: 'FULFILLMENT',
        emitted_event_ids: [eventId],
        audit_ref: auditRef,
        message: `All ${pos.length} purchase order(s) received. Order ${order.ref} is ready for production.`,
      }
    }

    return {
      success: true,
      entity_type: 'order',
      entity_id: input.order_id,
      status_after: order.status,
      message: allReceived
        ? `Order is already in ${order.status} status.`
        : `${receivedPOs}/${pos.length} purchase order(s) received. Waiting on ${pos.length - receivedPOs} pending.`,
    }
  },
}
