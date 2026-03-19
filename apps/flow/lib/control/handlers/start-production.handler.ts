/**
 * Flow — Start Production Handler
 *
 * Production start is gated by payment guard + production guard.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { StartProductionCommand } from '@/lib/commands/types'
import { orderRepo, productionRepo } from '@/lib/repositories'
import { checkProductionReadiness } from '@/lib/control/guards/production-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'

export const startProductionHandler: CommandHandler<StartProductionCommand> = {
  commandType: 'start_production',

  async execute(command, context): Promise<CommandResult> {
    const input = StartProductionCommand.parse(command)

    // Production guard (includes payment guard)
    const readiness = await checkProductionReadiness(
      input.order_id,
      input.purchase_order_id,
      input.vendor_id,
      context.org_id,
    )

    if (!readiness.allowed) {
      // Emit blocked event
      dispatchDomainEvent({
        type: 'payment_gate_blocked',
        actor_id: input.actor_id,
        org_id: context.org_id,
        entity_type: 'order',
        entity_id: input.order_id,
        correlation_id: context.correlation_id,
        metadata: { gate: 'production_start', blockers: readiness.blockers },
      })

      return {
        success: false,
        entity_type: 'order',
        entity_id: input.order_id,
        errors: [{
          code: 'PRODUCTION_BLOCKED',
          message: `Production start blocked: ${readiness.blockers.join('; ')}`,
          details: readiness,
        }],
      }
    }

    // Create production job
    const jobId = randomUUID()
    await productionRepo.create({
      id: jobId,
      orgId: context.org_id,
      orderId: input.order_id,
      purchaseOrderId: input.purchase_order_id,
      vendorId: input.vendor_id,
      status: 'in_production',
    })

    // Update order status
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'fulfillment',
      productionStatus: 'in_production',
    })

    const eventId = dispatchDomainEvent({
      type: 'production_started',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'production_job',
      entity_id: jobId,
      correlation_id: context.correlation_id,
      metadata: {
        order_id: input.order_id,
        vendor_id: input.vendor_id,
        purchase_order_id: input.purchase_order_id,
      },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'production_job',
      entity_id: jobId,
      action: 'production_started',
      status_after: 'IN_PRODUCTION',
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    return {
      success: true,
      entity_type: 'production_job',
      entity_id: jobId,
      status_after: 'IN_PRODUCTION',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Production started',
    }
  },
}
