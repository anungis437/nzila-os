/**
 * Flow — Convert Quote to Order Handler
 *
 * Creates an order from an accepted quote. The order becomes the
 * operational source of truth for all downstream execution.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { ConvertQuoteToOrderCommand } from '@/lib/commands/types'
import { quoteRepo, orderRepo } from '@/lib/repositories'
import { checkQuoteInvariants } from '@/lib/control/guards/invariant-guard'
import { canConvertQuoteToOrder } from '@/domain/conversion-rules'
import type { QuoteStatus } from '@/domain/entities'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const convertQuoteToOrderHandler: CommandHandler<ConvertQuoteToOrderCommand> = {
  commandType: 'convert_quote_to_order',

  async execute(command, context): Promise<CommandResult> {
    const input = ConvertQuoteToOrderCommand.parse(command)

    const inv = await checkQuoteInvariants(input.quote_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const quote = await quoteRepo.findById(input.quote_id, context.org_id)
    if (!quote) throw new EntityNotFoundError('quote', input.quote_id)

    // Domain conversion rule — checks status, customer, lines, and total
    const lines = await quoteRepo.findLines(input.quote_id)
    const lineCount = lines.length
    const conversionCheck = canConvertQuoteToOrder(
      { status: quote.status?.toUpperCase() as QuoteStatus, customer_id: quote.customerId, total_amount: Number(quote.total ?? 0) },
      lineCount,
    )
    if (!conversionCheck.valid) {
      return { success: false, errors: [{ code: 'CONVERSION_BLOCKED', message: conversionCheck.violations.join('; ') }] }
    }

    // Create order from quote
    const orderId = randomUUID()

    await orderRepo.create({
      id: orderId,
      orgId: context.org_id,
      ref: `ORD-${orderId.slice(0, 8).toUpperCase()}`,
      quoteId: input.quote_id,
      customerId: quote.customerId,
      status: 'created',
      subtotal: quote.subtotal ?? '0',
      taxTotal: quote.taxTotal ?? '0',
      total: quote.total ?? '0',
      paymentStatus: 'NOT_REQUIRED',
      productionStatus: 'NOT_STARTED',
      fulfillmentStatus: 'NOT_STARTED',
      createdBy: input.actor_id,
    })

    // Emit events
    const eventIds: string[] = []

    eventIds.push(dispatchDomainEvent({
      type: 'order_created',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'order',
      entity_id: orderId,
      correlation_id: context.correlation_id,
      metadata: { quote_id: input.quote_id, total: quote.total },
    }))

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'order',
      entity_id: orderId,
      action: 'order_created_from_quote',
      status_after: 'CREATED',
      correlation_id: context.correlation_id,
      metadata: { quote_id: input.quote_id },
    })

    return {
      success: true,
      entity_type: 'order',
      entity_id: orderId,
      status_after: 'CREATED',
      emitted_event_ids: eventIds,
      audit_ref: auditRef,
      message: `Order created from quote ${input.quote_id}`,
    }
  },
}
