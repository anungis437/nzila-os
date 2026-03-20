/**
 * Zonga — Compensation & Rollback Utilities
 *
 * Provides compensation actions for failed or partially-applied operations.
 * When a multi-step operation fails partway through, these functions
 * reverse the committed steps to restore consistency.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface CompensationResult {
  compensated: boolean
  action: string
  resourceId: string
  details?: string
}

/**
 * Mark a payout as failed and record the compensation in the audit log.
 * Called when Stripe execution succeeds but a subsequent step (audit, evidence) fails.
 */
export async function compensateFailedPayout(
  payoutId: string,
  orgId: string,
  reason: string,
): Promise<CompensationResult> {
  try {
    await platformDb.execute(
      sql`UPDATE zonga_payouts
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${payoutId} AND org_id = ${orgId}`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('payout.compensation.failed', 'system', 'payout', ${payoutId}, ${orgId},
        ${JSON.stringify({ reason, compensatedAt: new Date().toISOString() })}::jsonb)`,
    )

    logger.warn('Payout compensated after failure', { payoutId, reason })
    return { compensated: true, action: 'payout.failed', resourceId: payoutId }
  } catch (err) {
    logger.error('Compensation failed for payout', { payoutId, error: err })
    return {
      compensated: false,
      action: 'payout.failed',
      resourceId: payoutId,
      details: 'Compensation itself failed — manual intervention required',
    }
  }
}

/**
 * Cancel a pending ticket purchase when Stripe checkout fails or expires.
 */
export async function compensateFailedTicketPurchase(
  purchaseId: string,
  orgId: string,
  reason: string,
): Promise<CompensationResult> {
  try {
    await platformDb.execute(
      sql`UPDATE zonga_ticket_purchases
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${purchaseId} AND org_id = ${orgId} AND status = 'pending'`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('ticket.compensation.cancelled', 'system', 'ticket_purchase', ${purchaseId}, ${orgId},
        ${JSON.stringify({ reason, compensatedAt: new Date().toISOString() })}::jsonb)`,
    )

    logger.warn('Ticket purchase compensated', { purchaseId, reason })
    return { compensated: true, action: 'ticket.cancelled', resourceId: purchaseId }
  } catch (err) {
    logger.error('Compensation failed for ticket purchase', { purchaseId, error: err })
    return {
      compensated: false,
      action: 'ticket.cancelled',
      resourceId: purchaseId,
      details: 'Compensation itself failed — manual intervention required',
    }
  }
}

/**
 * Revert a release status transition when a post-transition step fails.
 */
export async function compensateReleaseTransition(
  releaseId: string,
  orgId: string,
  previousStatus: string,
  reason: string,
): Promise<CompensationResult> {
  try {
    await platformDb.execute(
      sql`UPDATE zonga_releases
      SET status = ${previousStatus}, updated_at = NOW()
      WHERE id = ${releaseId} AND org_id = ${orgId}`,
    )

    await platformDb.execute(
      sql`INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
      VALUES ('release.compensation.reverted', 'system', 'release', ${releaseId}, ${orgId},
        ${JSON.stringify({ previousStatus, reason, compensatedAt: new Date().toISOString() })}::jsonb)`,
    )

    logger.warn('Release transition compensated', { releaseId, previousStatus, reason })
    return { compensated: true, action: 'release.reverted', resourceId: releaseId }
  } catch (err) {
    logger.error('Compensation failed for release transition', { releaseId, error: err })
    return {
      compensated: false,
      action: 'release.reverted',
      resourceId: releaseId,
      details: 'Compensation itself failed — manual intervention required',
    }
  }
}
