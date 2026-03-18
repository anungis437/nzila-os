/**
 * Flow — Create Purchase Order Handler
 *
 * PO creation is gated by payment guard. No PO without payment clearance.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CreatePurchaseOrderCommand } from '@/lib/commands/types'
import { orderRepo, vendorRepo, purchaseOrderRepo } from '@/lib/repositories'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { checkCanGeneratePO } from '@/lib/control/guards/payment-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const createPurchaseOrderHandler: CommandHandler<CreatePurchaseOrderCommand> = {
  commandType: 'create_purchase_order',

  async execute(command, context): Promise<CommandResult> {
    const input = CreatePurchaseOrderCommand.parse(command)

    // 1. Invariants
    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    // 2. Payment guard — authoritative
    const paymentGate = await checkCanGeneratePO(input.order_id, context.org_id)
    if (!paymentGate.allowed) {
      dispatchDomainEvent({
        type: 'payment_gate_blocked',
        actor_id: input.actor_id,
        org_id: context.org_id,
        entity_type: 'order',
        entity_id: input.order_id,
        correlation_id: context.correlation_id,
        metadata: { gate: 'po_creation', reasons: paymentGate.reasons },
      })

      return {
        success: false,
        entity_type: 'order',
        entity_id: input.order_id,
        errors: [{
          code: 'PAYMENT_GATE_BLOCKED',
          message: `PO creation blocked: ${paymentGate.reasons.join('; ')}`,
          details: paymentGate,
        }],
      }
    }

    // 3. Vendor exists
    const vendor = await vendorRepo.findById(input.vendor_id, context.org_id)
    if (!vendor) throw new EntityNotFoundError('vendor', input.vendor_id)

    // 4. Create PO
    const poId = randomUUID()
    await purchaseOrderRepo.create({
      id: poId,
      orgId: context.org_id,
      orderId: input.order_id,
      vendorId: input.vendor_id,
      status: 'draft',
      totalAmount: order.total,
      expectedDelivery: input.expected_delivery ?? null,
      notes: input.notes ?? null,
      createdBy: input.actor_id,
    })

    // 5. Update order status
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'fulfillment',
    })

    const eventId = dispatchDomainEvent({
      type: 'po_created',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'purchase_order',
      entity_id: poId,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id, vendor_id: input.vendor_id },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'purchase_order',
      entity_id: poId,
      action: 'po_created',
      status_after: 'DRAFT',
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id },
    })

    return {
      success: true,
      entity_type: 'purchase_order',
      entity_id: poId,
      status_after: 'DRAFT',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Purchase order created',
    }
  },
}
