/**
 * What the pilot current and overview routes can honestly report about an enrolled organization.
 *
 * Gate 0 wave 2 (DEF-0B10-PIL-PILOT-ADOPTION-ENGAGEMENT-AND-RESOLUTION-FIGURES-ARE-ROW-UPDATE-PROXIES-…):
 *   - Organizer adoption and member engagement were the share of organization_members rows whose updated_at fell in the last
 *     30 days. Any edit of the row (an address, a role, a sync) moved it, so it measured row edits, not use of the system. No
 *     activity signal is recorded per member, so both rates are NOT MEASURED (null), never a proxy and never the stored
 *     pilot_enrollments value.
 *   - Average time to resolution used COALESCE(resolved_at, NOW()), so an open case counted as resolved at the moment of the
 *     request. It is now the mean over cases that were actually resolved; with no resolved case it is null.
 *   - Cases managed counts the live grievances created in the last 30 days, excluding the demo seed's numbered cases; it never
 *     falls back to the stored enrollment figure.
 *   - The health score is the value stored on the enrollment; the response says so.
 */
import { sql, type SQL } from 'drizzle-orm';

export const PILOT_MEASUREMENT_WINDOW_DAYS = 30;
export const PILOT_ACTIVITY_MEASUREMENT_VERSION = 'ue-pilot-activity-v1';

export interface PilotMetricsMeasurement {
  windowDays: number;
  methodVersion: string;
  organizerAdoptionRate: 'distinct_organizers_with_server_verified_activity_over_active_organizers' | 'not_measured_no_eligible_organizers';
  memberEngagementRate: 'distinct_members_with_server_verified_activity_over_active_members' | 'not_measured_no_eligible_members';
  organizerNumerator: number;
  organizerDenominator: number;
  memberNumerator: number;
  memberDenominator: number;
  casesManaged: 'live_grievances_created_in_window_excluding_demo_seed';
  avgTimeToResolution: 'mean_over_resolved_grievances_created_in_window' | 'not_measured_no_resolved_grievance';
  resolvedCases: number;
  healthScore: 'stored_enrollment_value';
  notes: string[];
}

export const ACTIVITY_MEASUREMENT_NOTE =
  'Activity uses distinct active direct members with server-recorded product actions in the fixed window; browser-only telemetry, demo bootstrap events and membership-row edits do not count.';

/** Columns of one organization's case statistics: cases_managed, resolved_cases, avg_resolution_hours. */
export function pilotCaseStatsColumns(): SQL {
  return sql`
    COUNT(*) AS cases_managed,
    COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) AS resolved_cases,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE resolved_at IS NOT NULL) AS avg_resolution_hours`;
}

/** The window and the demo-seed exclusion every case statistic applies. */
export function pilotCaseStatsWindow(): SQL {
  return sql`created_at > NOW() - (${PILOT_MEASUREMENT_WINDOW_DAYS} * INTERVAL '1 day')
    AND demo_seed_id IS NULL`;
}

export interface PilotCaseFigures {
  casesManaged: number;
  avgTimeToResolution: number | null;
  organizerAdoptionRate: number | null;
  memberEngagementRate: number | null;
  measurement: PilotMetricsMeasurement;
}

export interface PilotActivityFigures {
  organizerAdoptionRate: number | null;
  memberEngagementRate: number | null;
  organizerNumerator: number;
  organizerDenominator: number;
  memberNumerator: number;
  memberDenominator: number;
}

const boundedCount = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
};

/** Reproducible rates over real server-side actions and explicit eligible populations. */
export function pilotActivityFigures(row: Record<string, unknown> | undefined): PilotActivityFigures {
  const organizerNumerator = boundedCount(row?.organizer_numerator);
  const organizerDenominator = boundedCount(row?.organizer_denominator);
  const memberNumerator = boundedCount(row?.member_numerator);
  const memberDenominator = boundedCount(row?.member_denominator);
  const rate = (numerator: number, denominator: number) => denominator === 0 ? null : Math.round((Math.min(numerator, denominator) / denominator) * 10_000) / 100;
  return {
    organizerAdoptionRate: rate(organizerNumerator, organizerDenominator),
    memberEngagementRate: rate(memberNumerator, memberDenominator),
    organizerNumerator,
    organizerDenominator,
    memberNumerator,
    memberDenominator,
  };
}

/** Turns one organization's case statistics row (or none: no case in the window) into the figures the routes report. */
export function pilotCaseFigures(
  row: { cases_managed?: unknown; resolved_cases?: unknown; avg_resolution_hours?: unknown } | undefined,
  activity: PilotActivityFigures = pilotActivityFigures(undefined),
): PilotCaseFigures {
  const casesManaged = Number(row?.cases_managed ?? 0);
  const resolvedCases = Number(row?.resolved_cases ?? 0);
  const rawAverage = row?.avg_resolution_hours;
  const average = rawAverage === null || rawAverage === undefined ? Number.NaN : Number(rawAverage);
  const avgTimeToResolution = resolvedCases > 0 && Number.isFinite(average) ? Math.round(average) : null;
  return {
    casesManaged: Number.isFinite(casesManaged) ? casesManaged : 0,
    avgTimeToResolution,
    organizerAdoptionRate: activity.organizerAdoptionRate,
    memberEngagementRate: activity.memberEngagementRate,
    measurement: {
      windowDays: PILOT_MEASUREMENT_WINDOW_DAYS,
      methodVersion: PILOT_ACTIVITY_MEASUREMENT_VERSION,
      organizerAdoptionRate: activity.organizerDenominator === 0 ? 'not_measured_no_eligible_organizers' : 'distinct_organizers_with_server_verified_activity_over_active_organizers',
      memberEngagementRate: activity.memberDenominator === 0 ? 'not_measured_no_eligible_members' : 'distinct_members_with_server_verified_activity_over_active_members',
      organizerNumerator: activity.organizerNumerator,
      organizerDenominator: activity.organizerDenominator,
      memberNumerator: activity.memberNumerator,
      memberDenominator: activity.memberDenominator,
      casesManaged: 'live_grievances_created_in_window_excluding_demo_seed',
      avgTimeToResolution:
        avgTimeToResolution === null ? 'not_measured_no_resolved_grievance' : 'mean_over_resolved_grievances_created_in_window',
      resolvedCases: Number.isFinite(resolvedCases) ? resolvedCases : 0,
      healthScore: 'stored_enrollment_value',
      notes: [ACTIVITY_MEASUREMENT_NOTE],
    },
  };
}
