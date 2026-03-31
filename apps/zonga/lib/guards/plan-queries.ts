/**
 * Zonga — Plan Query Helpers.
 *
 * Lightweight DB helpers to fetch the current user's plan/subscription
 * status for use in server actions. These avoid circular imports by
 * going directly to the DB instead of through subscription-actions.
 */
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import type { ListenerPlan, CreatorPlan } from '@/lib/plans'

export interface ListenerPlanInfo {
  plan: ListenerPlan
  subscriptionStatus: string | null
}

export interface CreatorPlanInfo {
  plan: CreatorPlan
  subscriptionStatus: string | null
}

export async function getListenerPlan(
  listenerId: string,
  orgId: string | null,
): Promise<ListenerPlanInfo> {
  try {
    const whereClause = orgId
      ? sql`WHERE user_id = ${listenerId} AND org_id = ${orgId}`
      : sql`WHERE user_id = ${listenerId}`

    const [row] = (await platformDb.execute(
      sql`SELECT plan, subscription_status as "subscriptionStatus"
      FROM zonga_listeners
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT 1`,
    )) as unknown as [ListenerPlanInfo | undefined]

    return row ?? { plan: 'free', subscriptionStatus: null }
  } catch {
    return { plan: 'free', subscriptionStatus: null }
  }
}

export async function getCreatorPlan(
  creatorId: string,
  orgId: string,
): Promise<CreatorPlanInfo> {
  try {
    const [row] = (await platformDb.execute(
      sql`SELECT plan, subscription_status as "subscriptionStatus"
      FROM zonga_creators
      WHERE id = ${creatorId} AND org_id = ${orgId}`,
    )) as unknown as [CreatorPlanInfo | undefined]

    return row ?? { plan: 'starter', subscriptionStatus: null }
  } catch {
    return { plan: 'starter', subscriptionStatus: null }
  }
}
