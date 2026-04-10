/**
 * Zonga — Ownership Service
 *
 * Manages content ownership splits with verification.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type { OwnershipSplit } from './types'

/**
 * Set ownership splits for a piece of content.
 * All splits must sum to exactly 100%.
 */
export async function setOwnershipSplits(params: {
  contentId: string
  contentType: 'track' | 'release'
  orgId: string
  splits: Array<{
    ownerId: string
    ownerName: string
    ownershipPercentage: number
    role: OwnershipSplit['role']
  }>
}): Promise<{ ok: boolean; error?: string }> {
  const { contentId, contentType, orgId, splits } = params

  const total = splits.reduce((sum, s) => sum + s.ownershipPercentage, 0)
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, error: `Ownership must sum to 100%, got ${total}%` }
  }

  if (splits.some((s) => s.ownershipPercentage <= 0)) {
    return { ok: false, error: 'All ownership percentages must be positive' }
  }

  // Atomic replace
  await platformDb.execute(sql`
    DELETE FROM zonga_ownership_splits
    WHERE content_id = ${contentId} AND org_id = ${orgId}
  `)

  for (const split of splits) {
    await platformDb.execute(sql`
      INSERT INTO zonga_ownership_splits (
        content_id, content_type, owner_id, owner_name,
        ownership_percentage, role, org_id
      ) VALUES (
        ${contentId}, ${contentType},
        ${split.ownerId}, ${split.ownerName},
        ${split.ownershipPercentage}, ${split.role}, ${orgId}
      )
    `)
  }

  logger.info('Ownership splits updated', { contentId, splitCount: splits.length })
  return { ok: true }
}

/**
 * Get ownership splits for content.
 */
export async function getOwnershipSplits(contentId: string, orgId: string): Promise<OwnershipSplit[]> {
  const rows = await platformDb.execute(sql`
    SELECT * FROM zonga_ownership_splits
    WHERE content_id = ${contentId} AND org_id = ${orgId}
    ORDER BY ownership_percentage DESC
  `)

  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    contentId: r.content_id as string,
    contentType: r.content_type as 'track' | 'release',
    ownerId: r.owner_id as string,
    ownerName: r.owner_name as string,
    ownershipPercentage: Number(r.ownership_percentage),
    role: r.role as OwnershipSplit['role'],
    verifiedAt: r.verified_at ? new Date(r.verified_at as string) : undefined,
    orgId: r.org_id as string,
    createdAt: new Date(r.created_at as string),
  }))
}

/**
 * Verify an ownership claim (admin action).
 */
export async function verifyOwnership(
  ownershipId: string,
  orgId: string,
  verifiedBy: string,
): Promise<{ ok: boolean }> {
  await platformDb.execute(sql`
    UPDATE zonga_ownership_splits
    SET verified_at = now(), updated_at = now()
    WHERE id = ${ownershipId} AND org_id = ${orgId}
  `)
  logger.info('Ownership verified', { ownershipId, verifiedBy })
  return { ok: true }
}
