/**
 * Flow — Receive PO Line Handler
 *
 * Records receiving of a PO line item quantity.
 * Gated by invariant guard. Updates PO status if all lines received.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { ReceivePOLineCommand } from '@/lib/commands/types'
import { purchaseOrderRepo } from '@/lib/repositories'
import { checkPurchaseOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'
import { db, commercePurchaseOrderLines, commercePurchaseOrders } from '@nzila/db'
import { eq, and } from 'drizzle-orm'

export const receivePOLineHandler: CommandHandler<ReceivePOLineCommand> = {
  commandType: 'receive_po_line',

  async execute(command, context): Promise<CommandResult> {
    const input = ReceivePOLineCommand.parse(command)

    const inv = await checkPurchaseOrderInvariants(input.purchase_order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const po = await purchaseOrderRepo.findById(input.purchase_order_id, context.org_id)
    if (!po) throw new EntityNotFoundError('purchase_order', input.purchase_order_id)

    if (po.status === 'cancelled' || po.status === 'draft') {
      return { success: false, errors: [{ code: 'INVALID_STATE', message: `Cannot receive items on a ${po.status} purchase order.` }] }
    }

    // Update line received quantity
    const [line] = await db
      .select()
      .from(commercePurchaseOrderLines)
      .where(eq(commercePurchaseOrderLines.id, input.line_id))
      .limit(1)

    if (!line) throw new EntityNotFoundError('po_line', input.line_id)

    const newReceived = input.quantity_received
    await db
      .update(commercePurchaseOrderLines)
      .set({ quantityReceived: newReceived })
      .where(eq(commercePurchaseOrderLines.id, input.line_id))

    // Check if all PO lines are fully received
    const allLines = await purchaseOrderRepo.findLines(input.purchase_order_id)
    const allFullyReceived = allLines.every(
      (l) => l.id === input.line_id
        ? newReceived >= l.quantity
        : (l.quantityReceived ?? 0) >= l.quantity
    )
    const someReceived = allLines.some(
      (l) => l.id === input.line_id
        ? newReceived > 0
        : (l.quantityReceived ?? 0) > 0
    )

    const poStatusBefore = po.status
    const newPOStatus = allFullyReceived ? 'received' : someReceived ? 'partial_received' : po.status

    if (newPOStatus !== poStatusBefore) {
      await db
        .update(commercePurchaseOrders)
        .set({ status: newPOStatus, updatedAt: new Date() })
        .where(and(eq(commercePurchaseOrders.id, input.purchase_order_id), eq(commercePurchaseOrders.orgId, context.org_id)))
    }

    const eventId = dispatchDomainEvent({
      type: 'po_line_received',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      correlation_id: context.correlation_id,
      metadata: { line_id: input.line_id, quantity_received: newReceived, po_status: newPOStatus },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      action: 'po_line_received',
      status_before: poStatusBefore,
      status_after: newPOStatus,
      correlation_id: context.correlation_id,
      metadata: { line_id: input.line_id, quantity_received: newReceived },
    })

    return {
      success: true,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      status_after: newPOStatus,
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: allFullyReceived
        ? 'All items received. Purchase order complete.'
        : `Line item received (${newReceived}/${line.quantity}).`,
    }
  },
}
