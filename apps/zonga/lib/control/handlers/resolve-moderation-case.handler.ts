/**
 * Zonga — Resolve Moderation Case Handler
 *
 * Resolves or escalates a moderation case and notifies the content owner.
 */
import type { CommandHandler, CommandResult } from '../types'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { zongaRows } from '@/queries/action-context'
import { commandTransaction } from '../scoped-command-context'
import { appendZongaAudit } from '@/lib/services/primary-audit'
import { ResolveModerationCaseSchema } from '@nzila/zonga-core/schemas'
import { guardAdminActionReason } from '@/lib/guards/governance-guards'

export interface ResolveModerationCaseCommand {
  type: 'resolve_moderation_case'
  case_id: string
  status: string
  notes?: string
  actor_id: string
}

export const resolveModerationCaseHandler: CommandHandler<ResolveModerationCaseCommand> = {
  commandType: 'resolve_moderation_case',

  async execute(command, context): Promise<CommandResult> {
    // G1: Require resolution reason for admin action
    const reasonCheck = guardAdminActionReason(command.notes)
    if (!reasonCheck.passed) {
      return {
        success: false,
        errors: [
          {
            code: 'GOVERNANCE_VIOLATION',
            message: reasonCheck.details ?? 'Resolution reason required',
          },
        ],
      }
    }

    const transaction = commandTransaction(context)
    if (
      !transaction ||
      transaction.actorId !== command.actor_id ||
      transaction.orgId !== context.org_id ||
      !['admin', 'manager'].includes(transaction.role)
    )
      return {
        success: false,
        errors: [
          {
            code: 'VERIFIED_MODERATION_CONTEXT_REQUIRED',
            message: 'Verified moderation authority and transaction are required',
          },
        ],
      }
    const input = ResolveModerationCaseSchema.parse({
      caseId: command.case_id,
      resolution: command.status,
      notes: command.notes,
    })
    const [parent] = zongaRows<{ id: string; status: string }>(
      await transaction.db.execute(
        sql`SELECT id,status FROM public.zonga_moderation_cases WHERE id=${input.caseId}::uuid AND org_id=${transaction.orgId}::uuid FOR UPDATE`,
      ),
    )
    if (!parent)
      return {
        success: false,
        errors: [{ code: 'CASE_NOT_FOUND', message: 'Moderation case is unavailable' }],
      }
    const [updated] = zongaRows<{ id: string }>(
      await transaction.db.execute(
        sql`UPDATE public.zonga_moderation_cases SET status=${input.resolution},notes=${input.notes ?? null},resolved_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp() WHERE id=${parent.id}::uuid AND org_id=${transaction.orgId}::uuid RETURNING id`,
      ),
    )
    if (!updated) throw new Error('Moderation state was not stored')
    const [trace] = zongaRows<{ id: string }>(
      await transaction.db.execute(
        sql`INSERT INTO public.audit_log(action,actor_id,entity_type,org_id,metadata) VALUES('moderation.case.resolved',${transaction.actorId},'moderation_case',${transaction.orgId}::uuid,${JSON.stringify({ caseId: parent.id, status: input.resolution, previousStatus: parent.status, notes: input.notes ?? null })}::jsonb) RETURNING id`,
      ),
    )
    if (!trace) throw new Error('Moderation trace was not stored')
    await appendZongaAudit(transaction, {
      action: 'zonga.moderation.case.resolved',
      targetType: 'zonga.moderation_case',
      targetId: parent.id,
      afterJson: {
        caseId: parent.id,
        status: input.resolution,
        previousStatus: parent.status,
        notes: input.notes ?? null,
        traceId: trace.id,
      },
    })
    logger.info('Moderation case resolved via command bus', {
      caseId: parent.id,
      status: input.resolution,
    })

    return {
      success: true,
      entity_type: 'moderation_case',
      entity_id: command.case_id,
      status_after: command.status,
      audit_ref: context.correlation_id,
      message: `Moderation case ${command.status}`,
    }
  },
}
