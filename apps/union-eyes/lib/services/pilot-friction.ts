/**
 * Pilot Friction Detection Service
 *
 * Identifies drop-off points in the pilot user journey:
 *  - User logged in but created no case
 *  - Case created but no updates added
 *  - User inactive after first session
 *
 * These are flagged for review by pilot admins.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface FrictionUser {
  userId: string;
  lastSeen: string;
  daysSinceLastActivity: number;
}

export interface FrictionReport {
  /** Users who logged in but never created a case */
  loginNoCaseUsers: FrictionUser[];
  /** Users who created a case but never added an update */
  caseNoUpdateUsers: FrictionUser[];
  /** Users inactive for more than 3 days after their first session */
  inactiveAfterFirstSession: FrictionUser[];
}

/**
 * Generate a friction detection report for an organization.
 */
export async function getFrictionReport(
  organizationId: string,
): Promise<FrictionReport> {
  const [loginNoCaseUsers, caseNoUpdateUsers, inactiveAfterFirstSession] =
    await Promise.all([
      detectLoginNoCase(organizationId),
      detectCaseNoUpdate(organizationId),
      detectInactiveAfterFirst(organizationId),
    ]);

  return { loginNoCaseUsers, caseNoUpdateUsers, inactiveAfterFirstSession };
}

async function detectLoginNoCase(orgId: string): Promise<FrictionUser[]> {
  const result = await db.execute(sql`
    SELECT
      l.user_id,
      l.last_login::text AS last_seen,
      EXTRACT(DAY FROM NOW() - l.last_login)::int AS days_since_last_activity
    FROM (
      SELECT user_id, MAX(created_at) AS last_login
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'user_login'
      GROUP BY user_id
    ) l
    LEFT JOIN (
      SELECT DISTINCT user_id
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'case_created'
    ) c ON l.user_id = c.user_id
    WHERE c.user_id IS NULL
    ORDER BY l.last_login DESC
  `);
  return (result as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    lastSeen: String(r.last_seen),
    daysSinceLastActivity: Number(r.days_since_last_activity),
  }));
}

async function detectCaseNoUpdate(orgId: string): Promise<FrictionUser[]> {
  const result = await db.execute(sql`
    SELECT
      c.user_id,
      c.last_case::text AS last_seen,
      EXTRACT(DAY FROM NOW() - c.last_case)::int AS days_since_last_activity
    FROM (
      SELECT user_id, MAX(created_at) AS last_case
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'case_created'
      GROUP BY user_id
    ) c
    LEFT JOIN (
      SELECT DISTINCT user_id
      FROM pilot_events
      WHERE organization_id = ${orgId} AND event_type = 'update_added'
    ) u ON c.user_id = u.user_id
    WHERE u.user_id IS NULL
    ORDER BY c.last_case DESC
  `);
  return (result as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    lastSeen: String(r.last_seen),
    daysSinceLastActivity: Number(r.days_since_last_activity),
  }));
}

async function detectInactiveAfterFirst(orgId: string): Promise<FrictionUser[]> {
  const result = await db.execute(sql`
    SELECT
      u.user_id,
      u.last_activity::text AS last_seen,
      EXTRACT(DAY FROM NOW() - u.last_activity)::int AS days_since_last_activity
    FROM (
      SELECT user_id, MAX(created_at) AS last_activity
      FROM pilot_events
      WHERE organization_id = ${orgId}
      GROUP BY user_id
    ) u
    WHERE u.last_activity < NOW() - INTERVAL '3 days'
    ORDER BY u.last_activity ASC
  `);
  return (result as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    lastSeen: String(r.last_seen),
    daysSinceLastActivity: Number(r.days_since_last_activity),
  }));
}

/**
 * Summarize friction counts for the admin dashboard.
 */
export async function getFrictionSummary(
  organizationId: string,
): Promise<{
  loginNoCase: number;
  caseNoUpdate: number;
  inactive: number;
}> {
  const report = await getFrictionReport(organizationId);
  return {
    loginNoCase: report.loginNoCaseUsers.length,
    caseNoUpdate: report.caseNoUpdateUsers.length,
    inactive: report.inactiveAfterFirstSession.length,
  };
}
