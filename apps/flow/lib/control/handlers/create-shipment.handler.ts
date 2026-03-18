/**
 * Flow — Create Shipment Handler
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CreateShipmentCommand } from '@/lib/commands/types'
import { checkShipmentReadiness } from '@/lib/control/guards/shipment-guard'
import { createShipment as createShipmentRecord } from '@/lib/services/shipment-service'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'

export const createShipmentHandler: CommandHandler<CreateShipmentCommand> = {
  commandType: 'create_shipment',

  async execute(command, context): Promise<CommandResult> {
    const input = CreateShipmentCommand.parse(command)

    // Shipment guard
    const readiness = await checkShipmentReadiness(input.order_id, context.org_id)
    if (!readiness.allowed) {
      return {
        success: false,
        entity_type: 'order',
        entity_id: input.order_id,
        errors: [{
          code: 'SHIPMENT_BLOCKED',
          message: `Shipment creation blocked: ${readiness.blockers.join('; ')}`,
          details: readiness,
        }],
      }
    }

    // Create shipment via service
    const result = await createShipmentRecord(input.order_id, context.org_id, {
      carrier: input.carrier,
      trackingNumber: input.tracking_number,
    })

    const shipmentId = result.id

    const eventId = dispatchDomainEvent({
      type: 'shipment_created' as never,
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'shipment',
      entity_id: shipmentId,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'shipment',
      entity_id: shipmentId,
      action: 'shipment_created',
      status_after: 'PENDING',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'shipment',
      entity_id: shipmentId,
      status_after: 'PENDING',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Shipment created',
    }
  },
}
