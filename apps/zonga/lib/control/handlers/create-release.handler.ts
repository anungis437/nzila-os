/**
 * Zonga — Create Release Handler
 *
 * Creates a new release in DRAFT status.
 * Writes to zonga_releases + audit_log.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '../types'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  CreateReleaseSchema,
  buildZongaAuditEvent,
  ZongaAuditAction,
  ZongaEntityType,
  ReleaseStatus,
} from '@/lib/zonga-services'

export interface CreateReleaseCommand {
  type: 'create_release'
  title: string
  release_type: 'single' | 'ep' | 'album' | 'compilation'
  creator_id?: string
  creator_name?: string
  track_count?: number
  release_date?: string
  actor_id: string
}

export const createReleaseHandler: CommandHandler<CreateReleaseCommand> = {
  commandType: 'create_release',

  async execute(command, context): Promise<CommandResult> {
    // 1. Validate
    const parsed = CreateReleaseSchema.safeParse({
      title: command.title,
      type: command.release_type,
      creatorId: command.creator_id,
      creatorName: command.creator_name,
      trackCount: command.track_count,
      releaseDate: command.release_date,
    })
    if (!parsed.success) {
      return {
        success: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: 'Invalid release data',
          details: parsed.error.flatten().fieldErrors,
        }],
      }
    }

    const releaseId = randomUUID()

    // 2. Persist release
    await platformDb.execute(
      sql`INSERT INTO zonga_releases (id, org_id, creator_id, title, status, release_type, release_date)
      VALUES (${releaseId}, ${context.org_id}, ${command.creator_id ?? command.actor_id}, ${command.title},
        ${ReleaseStatus.DRAFT}, ${command.release_type}, ${command.release_date ? new Date(command.release_date) : null})`,
    )

    // 3. Audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('release.created', ${command.actor_id}, 'release', ${releaseId}, ${context.org_id},
        ${JSON.stringify({ title: command.title, type: command.release_type })}::jsonb)`,
    )

    const auditEvent = buildZongaAuditEvent({
      action: ZongaAuditAction.RELEASE_PUBLISH,
      entityType: ZongaEntityType.RELEASE,
      orgId: context.org_id,
      actorId: command.actor_id,
      targetId: releaseId,
      metadata: { title: command.title, type: command.release_type },
    })
    logger.info('Release created via command bus', { ...auditEvent })

    return {
      success: true,
      entity_type: 'release',
      entity_id: releaseId,
      status_after: ReleaseStatus.DRAFT,
      audit_ref: context.correlation_id,
      message: 'Release created',
    }
  },
}
