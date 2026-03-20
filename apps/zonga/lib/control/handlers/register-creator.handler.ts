/**
 * Zonga — Register Creator Handler
 *
 * Creates a new creator profile with associated account record.
 * Writes to zonga_creators + zonga_creator_accounts + audit_log.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '../types'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  CreateCreatorSchema,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  CreatorStatus,
} from '@/lib/zonga-services'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface RegisterCreatorCommand {
  type: 'register_creator'
  name: string
  email: string
  genre?: string
  country?: string
  actor_id: string
}

export const registerCreatorHandler: CommandHandler<RegisterCreatorCommand> = {
  commandType: 'register_creator',

  async execute(command, context): Promise<CommandResult> {
    // 1. Validate
    const parsed = CreateCreatorSchema.safeParse({
      name: command.name,
      email: command.email,
      genre: command.genre,
      country: command.country,
    })
    if (!parsed.success) {
      return {
        success: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: 'Invalid creator data',
          details: parsed.error.flatten().fieldErrors,
        }],
      }
    }

    const creatorId = randomUUID()

    // 2. Persist creator
    await platformDb.execute(
      sql`INSERT INTO zonga_creators (id, org_id, user_id, display_name, status, genre, country)
      VALUES (${creatorId}, ${context.org_id}, ${command.actor_id}, ${command.name},
        ${CreatorStatus.ACTIVE}, ${command.genre ?? null}, ${command.country ?? null})`,
    )

    // 3. Persist creator account
    await platformDb.execute(
      sql`INSERT INTO zonga_creator_accounts (org_id, creator_id, email, onboarding_status)
      VALUES (${context.org_id}, ${creatorId}, ${command.email}, 'registered')`,
    )

    // 4. Audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, metadata, org_id)
      VALUES ('creator.registered', ${command.actor_id}, 'creator', ${creatorId},
        ${JSON.stringify({ name: command.name, email: command.email })}::jsonb, ${context.org_id})`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.CREATOR_ACTIVATE,
      entityType: ZongaEntityType.CREATOR,
      orgId: context.org_id,
      actorId: command.actor_id,
      targetId: creatorId,
      metadata: { name: command.name },
    })
    logger.info('Creator registered via command bus', { ...auditEvent })

    // 5. Evidence pack
    const pack = buildEvidencePackFromAction({
      actionType: 'CREATOR_REGISTERED',
      orgId: context.org_id,
      executedBy: command.actor_id,
      actionId: randomUUID(),
    })
    await processEvidencePack(pack)

    return {
      success: true,
      entity_type: 'creator',
      entity_id: creatorId,
      status_after: CreatorStatus.ACTIVE,
      audit_ref: context.correlation_id,
      message: 'Creator registered',
    }
  },
}
