/**
 * Flow — Create Quote Handler
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CreateQuoteCommand } from '@/lib/commands/types'
import { quoteRepo } from '@/lib/repositories'
import { checkEntityExists } from '@/lib/control/guards/invariant-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'

export const createQuoteHandler: CommandHandler<CreateQuoteCommand> = {
  commandType: 'create_quote',

  async execute(command, context): Promise<CommandResult> {
    const input = CreateQuoteCommand.parse(command)
    const warnings: string[] = []

    // 1. Invariant: customer exists
    const customerCheck = await checkEntityExists('customer', input.customer_id, context.org_id)
    if (!customerCheck.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: customerCheck.violations.join('; ') }] }
    }

    // 2. Compute totals
    const subtotal = input.lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)

    // 3. Persist
    const quoteId = randomUUID()
    await quoteRepo.create({
      id: quoteId,
      orgId: context.org_id,
      ref: `QT-${quoteId.slice(0, 8).toUpperCase()}`,
      status: 'draft',
      customerId: input.customer_id,
      currency: input.currency,
      subtotal: String(subtotal),
      taxTotal: '0',
      total: String(subtotal),
      validUntil: input.valid_until ?? null,
      notes: input.notes ?? null,
      createdBy: input.actor_id,
    })

    await quoteRepo.insertLines(
      input.lines.map((line, idx) => ({
        id: randomUUID(),
        orgId: context.org_id,
        quoteId,
        description: line.description,
        sku: line.sku ?? null,
        quantity: line.quantity,
        unitPrice: String(line.unit_price),
        lineTotal: String(line.quantity * line.unit_price),
        sortOrder: idx,
      })),
    )

    // 4. Domain event
    const eventId = dispatchDomainEvent({
      type: 'quote_created',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'quote',
      entity_id: quoteId,
      correlation_id: context.correlation_id,
      metadata: { title: input.title, line_count: input.lines.length, total: subtotal },
    })

    // 5. Audit
    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'quote',
      entity_id: quoteId,
      action: 'quote_created',
      status_after: 'DRAFT',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'quote',
      entity_id: quoteId,
      status_after: 'DRAFT',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Quote created',
      warnings,
    }
  },
}
