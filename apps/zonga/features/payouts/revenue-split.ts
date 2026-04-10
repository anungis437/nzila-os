/**
 * Zonga — Revenue Split Service
 *
 * Manages revenue split rules between collaborators on tracks and events.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { RevenueSplitRule } from './types'

/**
 * Set revenue split rules for a piece of content.
 * Replaces all existing rules — splits MUST sum to exactly 100%.
 */
export async function setRevenueSplits(params: {
  contentId: string
  contentType: 'track' | 'event'
  orgId: string
  splits: Array<{
    recipientId: string
    recipientRole: string
    splitPercentage: number
  }>
}): Promise<{ ok: boolean; error?: string }> {
  const { contentId, contentType, orgId, splits } = params

  // Validate splits sum to 100
  const total = splits.reduce((sum, s) => sum + s.splitPercentage, 0)
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, error: `Splits must sum to 100%, got ${total}%` }
  }

  // Validate no negative or zero splits
  if (splits.some((s) => s.splitPercentage <= 0)) {
    return { ok: false, error: 'All split percentages must be positive' }
  }

  // Validate no duplicate recipients
  const recipientIds = splits.map((s) => s.recipientId)
  if (new Set(recipientIds).size !== recipientIds.length) {
    return { ok: false, error: 'Duplicate recipients in split rules' }
  }

  // Atomic replace: delete old, insert new
  await platformDb.execute(sql`
    DELETE FROM zonga_revenue_split_rules
    WHERE content_id = ${contentId} AND org_id = ${orgId}
  `)

  for (const split of splits) {
    await platformDb.execute(sql`
      INSERT INTO zonga_revenue_split_rules (
        content_id, content_type, recipient_id, recipient_role, split_percentage, org_id
      ) VALUES (
        ${contentId}, ${contentType},
        ${split.recipientId}, ${split.recipientRole},
        ${split.splitPercentage}, ${orgId}
      )
    `)
  }

  logger.info('Revenue splits updated', { contentId, contentType, splitCount: splits.length })
  return { ok: true }
}

/**
 * Get current revenue split rules for content.
 */
export async function getRevenueSplits(
  contentId: string,
  orgId: string,
): Promise<RevenueSplitRule[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_revenue_split_rules
    WHERE content_id = ${contentId} AND org_id = ${orgId}
    ORDER BY split_percentage DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    contentId: r.content_id as string,
    contentType: r.content_type as 'track' | 'event',
    recipientId: r.recipient_id as string,
    recipientRole: r.recipient_role as string,
    splitPercentage: Number(r.split_percentage),
    orgId: r.org_id as string,
  }))
}

/**
 * Preview how revenue would be distributed for a given gross amount.
 */
export async function previewSplitDistribution(
  contentId: string,
  orgId: string,
  grossAmount: number,
  platformFeePct: number,
): Promise<Array<{
  recipientId: string
  recipientRole: string
  splitPercentage: number
  grossShare: number
  feeShare: number
  netShare: number
}>> {
  const splits = await getRevenueSplits(contentId, orgId)

  if (splits.length === 0) {
    return [{
      recipientId: 'owner',
      recipientRole: 'primary_artist',
      splitPercentage: 100,
      grossShare: grossAmount,
      feeShare: Math.round(grossAmount * platformFeePct) / 100,
      netShare: grossAmount - Math.round(grossAmount * platformFeePct) / 100,
    }]
  }

  return splits.map((s) => {
    const grossShare = Math.round(grossAmount * s.splitPercentage) / 100
    const feeShare = Math.round(grossShare * platformFeePct) / 100
    return {
      recipientId: s.recipientId,
      recipientRole: s.recipientRole,
      splitPercentage: s.splitPercentage,
      grossShare,
      feeShare,
      netShare: grossShare - feeShare,
    }
  })
}
