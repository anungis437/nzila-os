/**
 * Pilot Metrics Service
 *
 * Derives engagement metrics from pilot_events:
 *  - time_to_first_case
 *  - time_to_first_update
 *  - cases_per_user
 *  - updates_per_case
 *  - daily_active_users
 *
 * All metrics are org-scoped.
 */

import { db } from "@/db";
import { pilotEvents } from "@/db/schema";
import { eq, and, sql, gte, lte, countDistinct } from "drizzle-orm";

export interface PilotMetrics {
  /** Average minutes from first login to first case created */
  timeToFirstCase: number | null;
  /** Average minutes from first case to first update */
  timeToFirstUpdate: number | null;
  /** Average cases per user */
  casesPerUser: number;
  /** Average updates per case */
  updatesPerCase: number;
  /** DAU for the given date */
  dailyActiveUsers: number;
  /** Total unique users */
  totalUsers: number;
  /** Total cases created */
  totalCases: number;
  /** Total updates added */
  totalUpdates: number;
}

/**
 * Compute all pilot engagement metrics for an organization.
 */
export async function getPilotMetrics(
  organizationId: string,
  date?: Date,
): Promise<PilotMetrics> {
  const targetDate = date ?? new Date();
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const [
    timeToFirstCase,
    timeToFirstUpdate,
    casesPerUser,
    updatesPerCase,
    dau,
    totals,
  ] = await Promise.all([
    computeTimeToFirstCase(organizationId),
    computeTimeToFirstUpdate(organizationId),
    computeCasesPerUser(organizationId),
    computeUpdatesPerCase(organizationId),
    computeDAU(organizationId, dayStart, dayEnd),
    computeTotals(organizationId),
  ]);

  return {
    timeToFirstCase,
    timeToFirstUpdate,
    casesPerUser,
    updatesPerCase,
    dailyActiveUsers: dau,
    ...totals,
  };
}

async function computeTimeToFirstCase(orgId: string): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (fc.created_at - fl.created_at)) / 60)::float AS avg_minutes
    FROM (
      SELECT user_id, MIN(created_at) AS created_at
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'user_login'
      GROUP BY user_id
    ) fl
    JOIN (
      SELECT user_id, MIN(created_at) AS created_at
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'first_case_created'
      GROUP BY user_id
    ) fc ON fl.user_id = fc.user_id
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return (row?.avg_minutes as number) ?? null;
}

async function computeTimeToFirstUpdate(orgId: string): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT AVG(EXTRACT(EPOCH FROM (fu.created_at - fc.created_at)) / 60)::float AS avg_minutes
    FROM (
      SELECT user_id, MIN(created_at) AS created_at
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'first_case_created'
      GROUP BY user_id
    ) fc
    JOIN (
      SELECT user_id, MIN(created_at) AS created_at
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'first_update_added'
      GROUP BY user_id
    ) fu ON fc.user_id = fu.user_id
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return (row?.avg_minutes as number) ?? null;
}

async function computeCasesPerUser(orgId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(COUNT(*)::float / NULLIF(COUNT(DISTINCT user_id), 0), 0)::float AS avg_cases
    FROM pilot_events
    WHERE organization_id = ${orgId} AND event_type = 'case_created'
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return (row?.avg_cases as number) ?? 0;
}

async function computeUpdatesPerCase(orgId: string): Promise<number> {
  const result = await db.execute(sql`
    WITH cases AS (
      SELECT DISTINCT (metadata->>'caseId') AS case_id
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'case_created'
    ),
    updates AS (
      SELECT (metadata->>'caseId') AS case_id, COUNT(*) AS update_count
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'update_added'
      GROUP BY metadata->>'caseId'
    )
    SELECT COALESCE(AVG(u.update_count), 0)::float AS avg_updates
    FROM cases c
    LEFT JOIN updates u ON c.case_id = u.case_id
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return (row?.avg_updates as number) ?? 0;
}

async function computeDAU(
  orgId: string,
  dayStart: Date,
  dayEnd: Date,
): Promise<number> {
  const result = await db
    .select({ dau: countDistinct(pilotEvents.userId) })
    .from(pilotEvents)
    .where(
      and(
        eq(pilotEvents.organizationId, orgId),
        gte(pilotEvents.createdAt, dayStart),
        lte(pilotEvents.createdAt, dayEnd),
      ),
    );
  return result[0]?.dau ?? 0;
}

async function computeTotals(orgId: string): Promise<{
  totalUsers: number;
  totalCases: number;
  totalUpdates: number;
}> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id)::int AS total_users,
      COUNT(*) FILTER (WHERE event_type = 'case_created')::int AS total_cases,
      COUNT(*) FILTER (WHERE event_type = 'update_added')::int AS total_updates
    FROM pilot_events
    WHERE organization_id = ${orgId}
  `);
  const row = result[0] as Record<string, unknown> | undefined;
  return {
    totalUsers: (row?.total_users as number) ?? 0,
    totalCases: (row?.total_cases as number) ?? 0,
    totalUpdates: (row?.total_updates as number) ?? 0,
  };
}

/**
 * Get daily active users trend for the last N days.
 */
export async function getDAUTrend(
  organizationId: string,
  days: number = 30,
): Promise<Array<{ date: string; users: number }>> {
  const result = await db.execute(sql`
    SELECT
      created_at::date AS day,
      COUNT(DISTINCT user_id)::int AS users
    FROM pilot_events
    WHERE organization_id = ${organizationId}
      AND created_at >= NOW() - INTERVAL '1 day' * ${days}
    GROUP BY created_at::date
    ORDER BY day
  `);
  return (result as any as Array<{ day: string; users: number }>).map((r) => ({
    date: String(r.day),
    users: Number(r.users),
  }));
}
