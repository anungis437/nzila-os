/**
 * Zonga — Takedown Service
 *
 * DMCA-style takedown requests with counter-filing support.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { TakedownRequest, TakedownStatus } from './types'
import { TAKEDOWN_TRANSITIONS } from './types'

export interface FileTakedownParams {
  contentId: string
  contentType: 'track' | 'release'
  requesterId: string
  requesterType: TakedownRequest['requesterType']
  reason: TakedownRequest['reason']
  description: string
  evidenceUrl?: string
  orgId: string
}

/**
 * File a takedown request against content.
 */
export async function fileTakedown(params: FileTakedownParams): Promise<{ ok: boolean; takedownId?: string }> {
  const { contentId, contentType, requesterId, requesterType, reason, description, evidenceUrl, orgId } = params

  // Check for duplicate active takedowns
  const existing = await platformDb.execute(sql`
    SELECT id FROM zonga_takedown_requests
    WHERE content_id = ${contentId} AND org_id = ${orgId}
      AND status NOT IN ('resolved', 'rejected')
    LIMIT 1
  `)
  if ((existing as unknown as Array<unknown>).length > 0) {
    return { ok: false }
  }

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_takedown_requests (
      content_id, content_type, requester_id, requester_type,
      reason, description, evidence_url, status, org_id
    ) VALUES (
      ${contentId}, ${contentType}, ${requesterId}, ${requesterType},
      ${reason}, ${description}, ${evidenceUrl ?? null}, 'requested', ${orgId}
    )
    RETURNING id
  `)
  const takedownId = (rows as unknown as Array<{ id: string }>)[0]?.id

  logger.info('Takedown filed', { takedownId, contentId, reason })
  return { ok: true, takedownId }
}

/**
 * Transition takedown request through its lifecycle.
 */
export async function transitionTakedownState(params: {
  takedownId: string
  orgId: string
  targetState: TakedownStatus
  actorId: string
}): Promise<{ ok: boolean; error?: string }> {
  const { takedownId, orgId, targetState, actorId } = params

  const rows = await platformDb.execute(sql`
    SELECT status, content_id, content_type FROM zonga_takedown_requests
    WHERE id = ${takedownId} AND org_id = ${orgId}
  `)
  const takedown = (rows as unknown as Array<Record<string, unknown>>)[0]
  if (!takedown) return { ok: false, error: 'Takedown request not found' }

  const currentState = takedown.status as TakedownStatus
  const allowed = TAKEDOWN_TRANSITIONS[currentState]

  if (!allowed?.includes(targetState)) {
    return { ok: false, error: `Cannot transition from "${currentState}" to "${targetState}"` }
  }

  await platformDb.execute(sql`
    UPDATE zonga_takedown_requests
    SET status = ${targetState},
        enforced_at = CASE WHEN ${targetState} = 'enforced' THEN now() ELSE enforced_at END,
        updated_at = now()
    WHERE id = ${takedownId} AND org_id = ${orgId}
  `)

  // If enforced, suspend the content
  if (targetState === 'enforced') {
    const contentId = takedown.content_id as string
    const contentType = takedown.content_type as string

    if (contentType === 'track') {
      await platformDb.execute(sql`
        UPDATE zonga_content_assets SET status = 'suspended', updated_at = now()
        WHERE id = ${contentId}::uuid
      `)
    } else if (contentType === 'release') {
      await platformDb.execute(sql`
        UPDATE zonga_releases SET status = 'suspended', updated_at = now()
        WHERE id = ${contentId}::uuid
      `)
    }
    logger.info('Content suspended via takedown', { contentId, takedownId })
  }

  // If resolved, restore content if it was suspended from this takedown
  if (targetState === 'resolved') {
    const contentId = takedown.content_id as string
    const contentType = takedown.content_type as string

    if (contentType === 'track') {
      await platformDb.execute(sql`
        UPDATE zonga_content_assets SET status = 'published', updated_at = now()
        WHERE id = ${contentId}::uuid AND status = 'suspended'
      `)
    } else if (contentType === 'release') {
      await platformDb.execute(sql`
        UPDATE zonga_releases SET status = 'published', updated_at = now()
        WHERE id = ${contentId}::uuid AND status = 'suspended'
      `)
    }
  }

  logger.info('Takedown state transition', { takedownId, from: currentState, to: targetState, actorId })
  return { ok: true }
}

/**
 * Get pending takedown requests for review.
 */
export async function getPendingTakedowns(orgId: string): Promise<TakedownRequest[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_takedown_requests
    WHERE org_id = ${orgId} AND status IN ('requested', 'under_review', 'counter_filed')
    ORDER BY created_at
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapTakedownRow)
}

/**
 * Get takedown history for content.
 */
export async function getTakedownHistory(contentId: string, orgId: string): Promise<TakedownRequest[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_takedown_requests
    WHERE content_id = ${contentId} AND org_id = ${orgId}
    ORDER BY created_at DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map(mapTakedownRow)
}

function mapTakedownRow(r: Record<string, unknown>): TakedownRequest {
  return {
    id: r.id as string,
    contentId: r.content_id as string,
    contentType: r.content_type as 'track' | 'release',
    requesterId: r.requester_id as string,
    requesterType: r.requester_type as TakedownRequest['requesterType'],
    reason: r.reason as TakedownRequest['reason'],
    description: r.description as string,
    evidenceUrl: r.evidence_url as string | undefined,
    status: r.status as TakedownStatus,
    enforcedAt: r.enforced_at ? new Date(r.enforced_at as string) : undefined,
    orgId: r.org_id as string,
    createdAt: new Date(r.created_at as string),
  }
}
