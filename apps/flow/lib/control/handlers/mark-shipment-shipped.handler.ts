/**
 * Flow — Mark Shipment Shipped Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { MarkShipmentShippedCommand } from '@/lib/commands/types'
import { checkCanMarkShipped } from '@/lib/control/guards/shipment-guard'
import { addTracking } from '@/lib/services/shipment-service'
import { orderRepo } from '@/lib/repositories'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'

export const markShipmentShippedHandler: CommandHandler<MarkShipmentShippedCommand> = {
  commandType: 'mark_shipment_shipped',

  async execute(command, context): Promise<CommandResult> {
    const input = MarkShipmentShippedCommand.parse(command)

    // Shipment guard
    const check = await checkCanMarkShipped(input.shipment_id, input.order_id, context.org_id)
    if (!check.allowed) {
      return {
        success: false,
        errors: [{
          code: 'INVALID_TRANSITION',
          message: `Cannot mark shipped: ${check.blockers.join('; ')}`,
        }],
      }
    }

    // Update via service
    await addTracking(input.shipment_id, context.org_id, {
      carrier: input.carrier,
      trackingNumber: input.tracking_number,
    }, input.actor_id)

    // Update order
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'shipped',
      fulfillmentStatus: 'SHIPPED',
    })

    const eventId = dispatchDomainEvent({
      type: 'order_shipped',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      correlation_id: context.correlation_id,
      metadata: {
        order_id: input.order_id,
        carrier: input.carrier,
        tracking_number: input.tracking_number,
      },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      action: 'shipment_shipped',
      status_before: 'PENDING',
      status_after: 'SHIPPED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'shipment',
      entity_id: input.shipment_id,
      status_after: 'SHIPPED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Shipment marked as shipped',
    }
  },
}
