/**
 * Flow — Mark Shipment Delivered Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { MarkShipmentDeliveredCommand } from '@/lib/commands/types'
import { checkCanMarkDelivered } from '@/lib/control/guards/shipment-guard'
import { markDelivered as markShipmentDelivered } from '@/lib/services/shipment-service'
import { orderRepo } from '@/lib/repositories'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'

export const markShipmentDeliveredHandler: CommandHandler<MarkShipmentDeliveredCommand> = {
  commandType: 'mark_shipment_delivered',

  async execute(command, context): Promise<CommandResult> {
    const input = MarkShipmentDeliveredCommand.parse(command)

    // Guard
    const check = await checkCanMarkDelivered(input.shipment_id, input.order_id, context.org_id)
    if (!check.allowed) {
      return {
        success: false,
        errors: [{
          code: 'INVALID_TRANSITION',
          message: `Cannot mark delivered: ${check.blockers.join('; ')}`,
        }],
      }
    }

    // Update
    await markShipmentDelivered(input.shipment_id, context.org_id, input.actor_id)

    // Update order
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'delivered',
      fulfillmentStatus: 'DELIVERED',
    })

    const eventId = dispatchDomainEvent({
      type: 'order_delivered',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      action: 'shipment_delivered',
      status_before: 'SHIPPED',
      status_after: 'DELIVERED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      status_after: 'DELIVERED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Shipment delivered',
    }
  },
}
