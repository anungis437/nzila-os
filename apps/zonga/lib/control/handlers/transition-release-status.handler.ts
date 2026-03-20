/**
 * Zonga — Transition Release Status Handler
 *
 * Transitions a release through the state machine (draft → scheduled → published → archived).
 * Uses the release state machine for validation.
 */
import { randomUUID } from 'node:crypto'
import type { CommandHandler, CommandResult } from '../types'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { ReleaseStatus } from '@/lib/zonga-services'
import { transitionRelease } from '@/lib/workflows/release-state-machine'
import { logTransition } from '@/lib/commerce-telemetry'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface TransitionReleaseStatusCommand {
  type: 'transition_release_status'
  release_id: string
  target_status: ReleaseStatus
  actor_id: string
}

export const transitionReleaseStatusHandler: CommandHandler<TransitionReleaseStatusCommand> = {
  commandType: 'transition_release_status',

  async execute(command, context): Promise<CommandResult> {
    // 1. Load current state
    const [release] = (await platformDb.execute(
      sql`SELECT id, status, title FROM zonga_releases
      WHERE id = ${command.release_id} AND org_id = ${context.org_id}`,
    )) as unknown as [{ id: string; status: ReleaseStatus; title: string } | undefined]

    if (!release) {
      return {
        success: false,
        errors: [{ code: 'NOT_FOUND', message: 'Release not found' }],
      }
    }

    // 2. State machine guard
    const result = transitionRelease(
      release.status as ReleaseStatus,
      command.target_status,
      { role: 'admin' as const, actorId: command.actor_id, orgId: context.org_id, meta: {} },
      command.release_id,
      { id: command.release_id, title: release.title },
    )

    if (!result.ok) {
      return {
        success: false,
        errors: [{
          code: 'TRANSITION_DENIED',
          message: `Transition not allowed: ${release.status} → ${command.target_status}`,
        }],
      }
    }

    // 3. Persist
    const now = new Date()
    await platformDb.execute(
      sql`UPDATE zonga_releases
      SET status = ${command.target_status},
          published_at = ${command.target_status === ReleaseStatus.PUBLISHED ? now : null},
          updated_at = ${now}
      WHERE id = ${command.release_id}`,
    )

    // 4. Audit trail
    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES (${'release.status_changed'}, ${command.actor_id}, 'release', ${command.release_id}, ${context.org_id},
        ${JSON.stringify({ from: release.status, to: command.target_status })}::jsonb)`,
    )

    logTransition({ orgId: context.org_id }, 'release', release.status, command.target_status, true)

    // 5. Evidence pack for publish
    if (command.target_status === ReleaseStatus.PUBLISHED) {
      const pack = buildEvidencePackFromAction({
        actionType: 'RELEASE_PUBLISHED',
        orgId: context.org_id,
        executedBy: command.actor_id,
        actionId: randomUUID(),
      })
      await processEvidencePack(pack)
    }

    logger.info('Release status transitioned via command bus', {
      releaseId: command.release_id,
      from: release.status,
      to: command.target_status,
    })

    return {
      success: true,
      entity_type: 'release',
      entity_id: command.release_id,
      status_after: command.target_status,
      audit_ref: context.correlation_id,
      message: `Release transitioned to ${command.target_status}`,
    }
  },
}
