/**
 * Zonga — Create Moderation Case Handler
 *
 * Opens a new content moderation case.
 * Writes to zonga_moderation_cases.
 */
import type { CommandHandler, CommandResult } from '../types'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface CreateModerationCaseCommand {
  type: 'create_moderation_case'
  entity_type: string
  target_entity_id: string
  case_type: string
  severity: string
  notes?: string
}

export const createModerationCaseHandler: CommandHandler<CreateModerationCaseCommand> = {
  commandType: 'create_moderation_case',

  async execute(command, context): Promise<CommandResult> {
    const [row] = (await platformDb.execute(
      sql`INSERT INTO zonga_moderation_cases (org_id, entity_type, entity_id, case_type, severity, notes)
      VALUES (${context.org_id}, ${command.entity_type}, ${command.target_entity_id}, ${command.case_type},
        ${command.severity}, ${command.notes ?? null})
      RETURNING id`,
    )) as unknown as [{ id: string }]

    const caseId = row?.id
    logger.info('Moderation case created via command bus', {
      caseId,
      entityType: command.entity_type,
    })

    return {
      success: true,
      entity_type: 'moderation_case',
      entity_id: caseId,
      status_after: 'open',
      audit_ref: context.correlation_id,
      message: 'Moderation case created',
    }
  },
}
