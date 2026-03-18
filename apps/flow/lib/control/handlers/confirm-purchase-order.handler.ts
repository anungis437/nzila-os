/**
 * Flow — Confirm Purchase Order Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { ConfirmPurchaseOrderCommand } from '@/lib/commands/types'
import { purchaseOrderRepo } from '@/lib/repositories'
import { checkPurchaseOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const confirmPurchaseOrderHandler: CommandHandler<ConfirmPurchaseOrderCommand> = {
  commandType: 'confirm_purchase_order',

  async execute(command, context): Promise<CommandResult> {
    const input = ConfirmPurchaseOrderCommand.parse(command)

    const inv = await checkPurchaseOrderInvariants(input.purchase_order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const po = await purchaseOrderRepo.findById(input.purchase_order_id, context.org_id)
    if (!po) throw new EntityNotFoundError('purchase_order', input.purchase_order_id)

    const wf = validateTransition('purchase_order', po.status, 'CONFIRMED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot confirm PO from status ${po.status}` }] }
    }

    const statusBefore = po.status
    await purchaseOrderRepo.update(input.purchase_order_id, context.org_id, { status: 'CONFIRMED' })

    const eventId = dispatchDomainEvent({
      type: 'po_confirmed',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      correlation_id: context.correlation_id,
      metadata: { from_status: statusBefore },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      action: 'po_confirmed',
      status_before: statusBefore,
      status_after: 'CONFIRMED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'purchase_order',
      entity_id: input.purchase_order_id,
      status_after: 'CONFIRMED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Purchase order confirmed',
    }
  },
}
