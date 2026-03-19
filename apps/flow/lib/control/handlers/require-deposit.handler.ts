/**
 * Flow — Require Deposit Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { RequireDepositCommand } from '@/lib/commands/types'
import { orderRepo } from '@/lib/repositories'
import { paymentRequirementRepo } from '@/lib/repositories/workflow-repository'
import { checkOrderInvariants } from '@/lib/control/guards/invariant-guard'
import { validateTransition } from '@/lib/control/guards/workflow-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'
import { randomUUID } from 'node:crypto'

export const requireDepositHandler: CommandHandler<RequireDepositCommand> = {
  commandType: 'require_deposit',

  async execute(command, context): Promise<CommandResult> {
    const input = RequireDepositCommand.parse(command)

    const inv = await checkOrderInvariants(input.order_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const order = await orderRepo.findById(input.order_id, context.org_id)
    if (!order) throw new EntityNotFoundError('order', input.order_id)

    // Transition to DEPOSIT_REQUIRED
    const wf = validateTransition('order', order.status, 'DEPOSIT_REQUIRED')
    if (!wf.allowed) {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: wf.reason ?? `Cannot require deposit from order status ${order.status}` }] }
    }

    const statusBefore = order.status
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'needs_attention',
      paymentStatus: 'PENDING_DEPOSIT',
    })

    // Save payment requirement (linked to quote if available)
    if (order.quoteId) {
      await paymentRequirementRepo.save({
        id: randomUUID(),
        orgId: context.org_id,
        quoteId: order.quoteId,
        depositRequired: input.deposit_required,
        depositPercent: input.deposit_percent ?? null,
        depositAmount: input.deposit_amount ?? null,
        dueBeforeProduction: input.due_before_production,
        createdAt: new Date(),
      })
    }

    const eventId = dispatchDomainEvent({
      type: 'deposit_required',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'order',
      entity_id: input.order_id,
      correlation_id: context.correlation_id,
      metadata: {
        deposit_percent: input.deposit_percent,
        deposit_amount: input.deposit_amount,
        due_before_production: input.due_before_production,
      },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'order',
      entity_id: input.order_id,
      action: 'deposit_required',
      status_before: statusBefore,
      status_after: 'DEPOSIT_REQUIRED',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'order',
      entity_id: input.order_id,
      status_after: 'DEPOSIT_REQUIRED',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Deposit requirement set',
    }
  },
}
