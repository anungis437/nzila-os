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
  orgId: string,
): Promise<ListenerPlanInfo> {
  try {
    const [row] = (await platformDb.execute(
      sql`SELECT plan, subscription_status as "subscriptionStatus"
      FROM zonga_listeners
      WHERE id = ${listenerId} AND org_id = ${orgId}`,
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

    return row ?? { plan: 'artist', subscriptionStatus: null }
  } catch {
    return { plan: 'artist', subscriptionStatus: null }
  }
}
