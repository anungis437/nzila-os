/**
 * Flow — Trigger Sales to Procurement Handler
 *
 * Governed quote → order → PO handoff using command bus only.
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { TriggerSalesToProcurementCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'
import { execute } from '@/lib/control/command-bus'

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
    if (currentStatus === 'ACCEPTED') {
      const wf = validateTransition('quote', currentStatus, 'READY_FOR_PO')
      if (!wf.allowed) {
        return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? 'Cannot transition to READY_FOR_PO' }] }
      }
    } else if (currentStatus !== 'READY_FOR_PO') {
      return { success: false, errors: [{ code: 'INVALID_STATE', message: `Quote must be ACCEPTED or READY_FOR_PO. Current: ${currentStatus}` }] }
    }

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

    const conversion = await execute({
      type: 'convert_quote_to_order',
      quote_id: input.quote_id,
      actor_id: input.actor_id,
      org_id: context.org_id,
    }, context)

    if (!conversion.success || !conversion.entity_id) {
      return {
        success: false,
        errors: [{ code: 'ORDER_CONVERSION_FAILED', message: conversion.errors?.map((e) => e.message).join('; ') ?? 'Failed to convert quote to order' }],
      }
    }
    const orderId = conversion.entity_id

    const poCreation = await execute({
      type: 'create_purchase_order',
      order_id: orderId,
      vendor_id: supplier.id,
      actor_id: input.actor_id,
      org_id: context.org_id,
    }, context)

    if (!poCreation.success || !poCreation.entity_id) {
      return {
        success: false,
        errors: [{ code: 'PO_CREATION_FAILED', message: poCreation.errors?.map((e) => e.message).join('; ') ?? 'Failed to create purchase order' }],
      }
    }
    const poId = poCreation.entity_id

    const eventId = dispatchDomainEvent({
      type: 'sales_to_procurement_triggered',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: input.quote_id,
      correlation_id: context.correlation_id,
      metadata: { order_id: orderId, po_id: poId },
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
      metadata: { order_id: orderId, po_id: poId },
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: input.quote_id,
      status_after: 'READY_FOR_PO',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Sales to procurement handoff complete',
    }
  },
}
