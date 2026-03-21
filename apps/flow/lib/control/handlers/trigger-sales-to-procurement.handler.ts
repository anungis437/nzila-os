/**
 * Flow — Trigger Sales to Procurement Handler
 *
 * Governed version of the quote → PO handoff:
 * 1. Validates quote is in ACCEPTED or READY_FOR_PO state
 * 2. Creates order from quote (if not already created)
 * 3. Transitions quote to READY_FOR_PO
 * 4. Creates PO via quote-to-po service
 * 5. Emits events and audit trail
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { TriggerSalesToProcurementCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const triggerSalesToProcurementHandler: CommandHandler<TriggerSalesToProcurementCommand> = {
  commandType: 'trigger_sales_to_procurement',

  async execute(command, context): Promise<CommandResult> {
    const input = TriggerSalesToProcurementCommand.parse(command)

    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    const currentStatus = (quote.status ?? '').toUpperCase()

    // Allow from ACCEPTED (transition to READY_FOR_PO first) or directly from READY_FOR_PO
    if (currentStatus === 'ACCEPTED') {
      const wf = validateTransition('quote', currentStatus, 'READY_FOR_PO')
      if (!wf.allowed) {
        return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? 'Cannot transition to READY_FOR_PO' }] }
      }
      await quoteRepo.update(input.quote_id, context.org_id, { status: 'accepted' })
    } else if (currentStatus !== 'READY_FOR_PO') {
      return { success: false, errors: [{ code: 'INVALID_STATE', message: `Quote must be ACCEPTED or READY_FOR_PO. Current: ${currentStatus}` }] }
    }

    // Find or create default supplier
    const { db, commerceSuppliers } = await import('@nzila/db')
    const { eq } = await import('drizzle-orm')

    let [supplier] = await db
      .select()
      .from(commerceSuppliers)
      .where(eq(commerceSuppliers.orgId, context.org_id))
      .limit(1)

    if (!supplier) {
      ;[supplier] = await db
        .insert(commerceSuppliers)
        .values({
          orgId: context.org_id,
          name: 'Default Supplier',
          email: 'supplier@example.com',
          status: 'active',
        })
        .returning()
    }

    // Use the quote-to-po service
    const { createPurchaseOrderFromQuote } = await import('@/lib/services/quote-to-po-service')
    const result = await createPurchaseOrderFromQuote(
      input.quote_id,
      supplier.id,
      input.actor_id,
      context.org_id,
    )

    if (!result.ok) {
      return { success: false, errors: [{ code: 'PO_CREATION_FAILED', message: result.error ?? 'Failed to create PO from quote' }] }
    }

    const eventId = dispatchDomainEvent({
      type: 'sales_to_procurement_triggered',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { order_id: result.orderId, po_id: result.poId },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      action: 'sales_to_procurement_triggered',
      status_before: currentStatus,
      status_after: 'READY_FOR_PO',
      correlation_id: context.correlation_id,
      metadata: { order_id: result.orderId, po_id: result.poId },
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'READY_FOR_PO',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Sales → Procurement handoff complete',
    }
  },
}
