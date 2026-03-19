/**
 * Flow — Complete Production Handler
 */
import type { CommandHandler, CommandResult } from '@/lib/control/types'
import { CompleteProductionCommand } from '@/lib/commands/types'
import { orderRepo, productionRepo } from '@/lib/repositories'
import { checkProductionJobInvariants } from '@/lib/control/guards/invariant-guard'
import { dispatchDomainEvent } from '@/lib/control/dispatch/event-dispatcher'
import { dispatchAuditEntry } from '@/lib/control/dispatch/audit-dispatcher'
import { EntityNotFoundError } from '@/lib/control/errors/entity-not-found-error'

export const completeProductionHandler: CommandHandler<CompleteProductionCommand> = {
  commandType: 'complete_production',

  async execute(command, context): Promise<CommandResult> {
    const input = CompleteProductionCommand.parse(command)

    const inv = await checkProductionJobInvariants(input.production_job_id, context.org_id)
    if (!inv.valid) {
      return { success: false, errors: [{ code: 'INVARIANT_VIOLATION', message: inv.violations.join('; ') }] }
    }

    const job = await productionRepo.findById(input.production_job_id, context.org_id)
    if (!job) throw new EntityNotFoundError('production_job', input.production_job_id)

    if (job.status !== 'in_production' && job.status !== 'quality_check') {
      return { success: false, errors: [{ code: 'INVALID_TRANSITION', message: `Cannot complete production from status ${job.status}` }] }
    }

    const statusBefore = job.status
    await productionRepo.update(input.production_job_id, context.org_id, {
      status: 'ready_to_ship',
      qualityCheckedAt: new Date(),
    })

    // Update order production status
    await orderRepo.update(input.order_id, context.org_id, {
      status: 'fulfillment',
      productionStatus: 'COMPLETE',
    })

    const eventId = dispatchDomainEvent({
      type: 'production_completed',
      actor_id: input.actor_id,
      org_id: context.org_id,
      entity_type: 'production_job',
      entity_id: input.production_job_id,
      correlation_id: context.correlation_id,
      metadata: { order_id: input.order_id, from_status: statusBefore },
    })

    const auditRef = await dispatchAuditEntry({
      org_id: context.org_id,
      actor_id: input.actor_id,
      entity_type: 'production_job',
      entity_id: input.production_job_id,
      action: 'production_completed',
      status_before: statusBefore,
      status_after: 'READY_TO_SHIP',
      correlation_id: context.correlation_id,
    })

    return {
      success: true,
      entity_type: 'production_job',
      entity_id: input.production_job_id,
      status_after: 'READY_TO_SHIP',
      emitted_event_ids: [eventId],
      audit_ref: auditRef,
      message: 'Production completed',
    }
  },
}
