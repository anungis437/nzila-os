/**
 * Zonga — Resolve Moderation Case Handler
 *
 * Resolves or escalates a moderation case and notifies the content owner.
 */
import type { CommandHandler, CommandResult } from '../types'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

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
    await platformDb.execute(
      sql`UPDATE zonga_moderation_cases
      SET status = ${command.status}, notes = ${command.notes ?? null},
        resolved_at = NOW(), assigned_to = ${command.actor_id}
      WHERE id = ${command.case_id} AND org_id = ${context.org_id}`,
    )

    logger.info('Moderation case resolved via command bus', {
      caseId: command.case_id,
      status: command.status,
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
