/**
 * Zonga — Moderation Service
 *
 * Content review pipeline for tracks, releases, events, and profiles.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { ModerationDecision, ModerationVerdict } from './types'

export interface SubmitModerationParams {
  contentId: string
  contentType: ModerationDecision['contentType']
  reviewerId: string
  verdict: ModerationVerdict
  reason?: string
  policyViolation?: string
  orgId: string
}

/**
 * Record a moderation decision and apply side-effects.
 */
export async function submitModerationDecision(params: SubmitModerationParams): Promise<{ ok: boolean; decisionId?: string }> {
  const { contentId, contentType, reviewerId, verdict, reason, policyViolation, orgId } = params

  const rows = await platformDb.execute(sql`
    INSERT INTO zonga_moderation_decisions (
      content_id, content_type, reviewer_id, verdict,
      reason, policy_violation, org_id
    ) VALUES (
      ${contentId}, ${contentType}, ${reviewerId}, ${verdict},
      ${reason ?? null}, ${policyViolation ?? null}, ${orgId}
    )
    RETURNING id
  `)
  const decisionId = (rows as unknown as Array<{ id: string }>)[0]?.id

  // Apply side-effects based on verdict and content type
  if (contentType === 'track' || contentType === 'release') {
    await applyContentModerationOutcome(contentId, contentType, verdict)
  } else if (contentType === 'event') {
    await applyEventModerationOutcome(contentId, verdict)
  }

  logger.info('Moderation decision recorded', { decisionId, contentId, contentType, verdict })
  return { ok: true, decisionId }
}

/**
 * Get moderation queue — items awaiting review.
 */
export async function getModerationQueue(
  orgId: string,
  contentType?: ModerationDecision['contentType'],
): Promise<Array<{
  contentId: string
  contentType: string
  title: string
  submittedBy: string
  submittedAt: Date
  pendingSince: Date
}>> {
  // Tracks in 'ready_for_review' status without a moderation decision
  const trackRows = !contentType || contentType === 'track'
    ? await platformDb.execute(sql`
        SELECT
          ca.id as content_id,
          'track' as content_type,
          ca.title,
          ca.uploader_id as submitted_by,
          ca.created_at as submitted_at,
          ca.updated_at as pending_since
        FROM zonga_content_assets ca
        WHERE ca.org_id = ${orgId}
          AND ca.status = 'ready_for_review'
          AND NOT EXISTS (
            SELECT 1 FROM zonga_moderation_decisions md
            WHERE md.content_id = ca.id::text
              AND md.verdict IN ('approved', 'rejected')
          )
        ORDER BY ca.updated_at
      `)
    : []

  const eventRows = !contentType || contentType === 'event'
    ? await platformDb.execute(sql`
        SELECT
          e.id as content_id,
          'event' as content_type,
          e.title,
          e.creator_id as submitted_by,
          e.created_at as submitted_at,
          e.updated_at as pending_since
        FROM zonga_events e
        WHERE e.org_id = ${orgId}
          AND e.status = 'pending_review'
          AND NOT EXISTS (
            SELECT 1 FROM zonga_moderation_decisions md
            WHERE md.content_id = e.id::text
              AND md.verdict IN ('approved', 'rejected')
          )
        ORDER BY e.updated_at
      `)
    : []

  const allRows = [
    ...(trackRows as unknown as Array<Record<string, unknown>>),
    ...(eventRows as unknown as Array<Record<string, unknown>>),
  ]

  return allRows.map((r) => ({
    contentId: r.content_id as string,
    contentType: r.content_type as string,
    title: r.title as string,
    submittedBy: r.submitted_by as string,
    submittedAt: new Date(r.submitted_at as string),
    pendingSince: new Date(r.pending_since as string),
  }))
}

/**
 * Get moderation history for a piece of content.
 */
export async function getModerationHistory(contentId: string, orgId: string): Promise<ModerationDecision[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_moderation_decisions
    WHERE content_id = ${contentId} AND org_id = ${orgId}
    ORDER BY created_at DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    contentId: r.content_id as string,
    contentType: r.content_type as ModerationDecision['contentType'],
    reviewerId: r.reviewer_id as string,
    verdict: r.verdict as ModerationVerdict,
    reason: r.reason as string | undefined,
    policyViolation: r.policy_violation as string | undefined,
    orgId: r.org_id as string,
    createdAt: new Date(r.created_at as string),
  }))
}

// ── Side-Effects ────────────────────────────────────────────────────────────

async function applyContentModerationOutcome(
  contentId: string,
  contentType: 'track' | 'release',
  verdict: ModerationVerdict,
): Promise<void> {
  const statusMap: Record<ModerationVerdict, string> = {
    approved: 'published',
    rejected: 'removed',
    needs_revision: 'draft',
    escalated: 'ready_for_review',
  }
  const newStatus = statusMap[verdict]

  if (contentType === 'track') {
    await platformDb.execute(sql`
      UPDATE zonga_content_assets SET status = ${newStatus}, updated_at = now()
      WHERE id = ${contentId}::uuid
    `)
  } else {
    await platformDb.execute(sql`
      UPDATE zonga_releases SET status = ${newStatus}, updated_at = now()
      WHERE id = ${contentId}::uuid
    `)
  }
}

async function applyEventModerationOutcome(
  eventId: string,
  verdict: ModerationVerdict,
): Promise<void> {
  const statusMap: Record<ModerationVerdict, string> = {
    approved: 'published',
    rejected: 'cancelled',
    needs_revision: 'draft',
    escalated: 'pending_review',
  }

  await platformDb.execute(sql`
    UPDATE zonga_events SET status = ${statusMap[verdict]}, updated_at = now()
    WHERE id = ${eventId}::uuid
  `)
}
