/**
 * Pilot Signals Service
 *
 * Part 8 — Champion Signal Detection:
 *   Identifies high-value users based on frequent usage, multiple cases,
 *   and consistent updates. Marks them as potential champions.
 *
 * Part 9 — Conversion Readiness Signal:
 *   Determines when an org is "ready" based on consistent usage,
 *   multiple active users, and repeated case tracking.
 *   Surfaced internally (no UI needed yet).
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

// ============================================================================
// CHAMPION DETECTION
// ============================================================================

export interface ChampionCandidate {
  userId: string;
  totalEvents: number;
  casesCreated: number;
  updatesAdded: number;
  activeDays: number;
  score: number;
}

/**
 * Identify potential champion users within an organization.
 *
 * Criteria:
 *  - ≥ 3 cases created
 *  - ≥ 5 updates added
 *  - ≥ 5 active days
 *
 * Score = (cases × 3) + (updates × 2) + activeDays
 */
export async function detectChampions(
  organizationId: string,
): Promise<ChampionCandidate[]> {
  const result = await db.execute(sql`
    SELECT
      user_id,
      COUNT(*)::int AS total_events,
      COUNT(*) FILTER (WHERE event_type = 'case_created')::int AS cases_created,
      COUNT(*) FILTER (WHERE event_type = 'update_added')::int AS updates_added,
      COUNT(DISTINCT created_at::date)::int AS active_days,
      (
        COUNT(*) FILTER (WHERE event_type = 'case_created') * 3 +
        COUNT(*) FILTER (WHERE event_type = 'update_added') * 2 +
        COUNT(DISTINCT created_at::date)
      )::int AS score
    FROM pilot_events
    WHERE organization_id = ${organizationId}
    GROUP BY user_id
    HAVING
      COUNT(*) FILTER (WHERE event_type = 'case_created') >= 3
      AND COUNT(*) FILTER (WHERE event_type = 'update_added') >= 5
      AND COUNT(DISTINCT created_at::date) >= 5
    ORDER BY score DESC
  `);

  return (result as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    totalEvents: Number(r.total_events),
    casesCreated: Number(r.cases_created),
    updatesAdded: Number(r.updates_added),
    activeDays: Number(r.active_days),
    score: Number(r.score),
  }));
}

// ============================================================================
// CONVERSION READINESS
// ============================================================================

export interface ConversionReadiness {
  organizationId: string;
  isReady: boolean;
  signals: {
    /** At least 3 unique active users in the last 14 days */
    multipleActiveUsers: boolean;
    /** At least 10 cases created across the org */
    sufficientCaseVolume: boolean;
    /** At least 5 updates added (shows ongoing tracking) */
    repeatedTracking: boolean;
    /** Usage in at least 5 of the last 14 days */
    consistentUsage: boolean;
  };
  activeUsers14d: number;
  totalCases: number;
  totalUpdates: number;
  activeDays14d: number;
}

/**
 * Assess whether an organization is ready for conversion from pilot to paid.
 *
 * An org is "ready" when ALL signals are true:
 *  - ≥ 3 unique active users in the last 14 days
 *  - ≥ 10 total cases created
 *  - ≥ 5 total updates added
 *  - Activity on ≥ 5 of the last 14 days
 */
export async function assessConversionReadiness(
  organizationId: string,
): Promise<ConversionReadiness> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (
        WHERE created_at >= NOW() - INTERVAL '14 days'
      )::int AS active_users_14d,
      COUNT(*) FILTER (WHERE event_type = 'case_created')::int AS total_cases,
      COUNT(*) FILTER (WHERE event_type = 'update_added')::int AS total_updates,
      COUNT(DISTINCT created_at::date) FILTER (
        WHERE created_at >= NOW() - INTERVAL '14 days'
      )::int AS active_days_14d
    FROM pilot_events
    WHERE organization_id = ${organizationId}
  `);

  const row = (result as Array<Record<string, unknown>>)[0] ?? {};
  const activeUsers14d = Number(row.active_users_14d ?? 0);
  const totalCases = Number(row.total_cases ?? 0);
  const totalUpdates = Number(row.total_updates ?? 0);
  const activeDays14d = Number(row.active_days_14d ?? 0);

  const signals = {
    multipleActiveUsers: activeUsers14d >= 3,
    sufficientCaseVolume: totalCases >= 10,
    repeatedTracking: totalUpdates >= 5,
    consistentUsage: activeDays14d >= 5,
  };

  return {
    organizationId,
    isReady: Object.values(signals).every(Boolean),
    signals,
    activeUsers14d,
    totalCases,
    totalUpdates,
    activeDays14d,
  };
}
