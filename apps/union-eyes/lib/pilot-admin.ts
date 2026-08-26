/**
 * CUPE Pilot Admin — Status & Health
 *
 * PR-060: Admin console completion — provides a health check
 * endpoint and status summary for the CUPE pilot deployment.
 *
 * Reality-remediation Wave 0: introduced the `'unknown'` health-check
 * state and the `'remediation_in_progress'` overall status so the
 * endpoint stops silently returning `'healthy'` for checks that were
 * never measured. Callers MUST classify each `PilotConfiguration` flag
 * as either measured (`true`/`false`) or unmeasured (`null`) — the
 * runtime then reflects that truthfully instead of assuming green.
 */

import type { CaseRow } from './dashboard-metrics';
import { computeKPIs, computeWorksiteCounts, computeAssigneeCounts } from './dashboard-metrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PilotHealthCheck {
  /**
   * Overall health rollup.
   *
   * - `healthy` — every check passed and was actually measured.
   * - `degraded` — at least one measured check is `warn` but nothing failed
   *   and nothing is `unknown`.
   * - `critical` — at least one measured check failed.
   * - `remediation_in_progress` — at least one required check is `unknown`
   *   (not yet wired to a real measurement). This status MUST be surfaced
   *   as-is; downstream UIs and dashboards may not upgrade it to `healthy`.
   */
  status: 'healthy' | 'degraded' | 'critical' | 'remediation_in_progress';
  checks: HealthCheckItem[];
  summary: string;
  timestamp: string;
}

export interface HealthCheckItem {
  name: string;
  /**
   * - `pass` — check ran and passed.
   * - `warn` — check ran and returned a non-fatal concern.
   * - `fail` — check ran and failed.
   * - `unknown` — the check has NOT been measured. Callers MUST NOT map
   *   `unknown` to `pass` in any dashboard/UI. Its presence forces the
   *   overall status to `remediation_in_progress`.
   */
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  message: string;
}

export interface PilotStatus {
  phase: string;
  health: PilotHealthCheck;
  metrics: {
    totalCases: number;
    openCases: number;
    overdueCases: number;
    activeWorksites: number;
    activeAssignees: number;
  };
  configuration: PilotConfiguration;
}

/**
 * Pilot configuration flags.
 *
 * Every flag is nullable: `null` means "not yet measured against the deployed
 * runtime". Callers MUST pass `null` for any flag they cannot back with a
 * real query — passing `true` unconditionally is a fabricated-provenance
 * violation.
 */
export interface PilotConfiguration {
  vocabularyLoaded: boolean | null;
  orgConfigured: boolean | null;
  /** `null` when the count could not be measured; a non-negative integer otherwise. */
  usersInvited: number | null;
  /** `null` when the count could not be measured; a non-negative integer otherwise. */
  worksitesConfigured: number | null;
  slaThresholdsSet: boolean | null;
  auditTrailActive: boolean | null;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Run pilot health checks against current state.
 *
 * Any `null` field on `config` is rendered as an `unknown` HealthCheckItem
 * and forces the overall health rollup to `remediation_in_progress`.
 */
export function runHealthChecks(config: PilotConfiguration, cases: CaseRow[]): PilotHealthCheck {
  const checks: HealthCheckItem[] = [];

  // Vocabulary
  if (config.vocabularyLoaded === null) {
    checks.push({
      name: 'Vocabulary',
      status: 'unknown',
      message: 'Vocabulary check is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'Vocabulary',
      status: config.vocabularyLoaded ? 'pass' : 'fail',
      message: config.vocabularyLoaded
        ? 'CUPE vocabulary loaded and accessible'
        : 'CUPE vocabulary not loaded — run seed endpoint',
    });
  }

  // Org
  if (config.orgConfigured === null) {
    checks.push({
      name: 'Organization',
      status: 'unknown',
      message: 'Pilot-organization check is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'Organization',
      status: config.orgConfigured ? 'pass' : 'fail',
      message: config.orgConfigured
        ? 'Pilot organization configured'
        : 'No pilot organization — create via admin console',
    });
  }

  // Users
  if (config.usersInvited === null) {
    checks.push({
      name: 'Users',
      status: 'unknown',
      message: 'Invited-user count is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'Users',
      status: config.usersInvited >= 2 ? 'pass' : config.usersInvited >= 1 ? 'warn' : 'fail',
      message: `${config.usersInvited} user(s) invited (minimum 2 recommended)`,
    });
  }

  // Worksites
  if (config.worksitesConfigured === null) {
    checks.push({
      name: 'Worksites',
      status: 'unknown',
      message: 'Worksite count is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'Worksites',
      status: config.worksitesConfigured >= 1 ? 'pass' : 'fail',
      message: `${config.worksitesConfigured} worksite(s) configured`,
    });
  }

  // SLA
  if (config.slaThresholdsSet === null) {
    checks.push({
      name: 'SLA Thresholds',
      status: 'unknown',
      message: 'SLA-thresholds check is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'SLA Thresholds',
      status: config.slaThresholdsSet ? 'pass' : 'warn',
      message: config.slaThresholdsSet
        ? 'SLA thresholds configured'
        : 'Using default SLA thresholds (3/7/14/30 days)',
    });
  }

  // Audit trail
  if (config.auditTrailActive === null) {
    checks.push({
      name: 'Audit Trail',
      status: 'unknown',
      message: 'Audit-trail freshness is NOT measured against the deployed runtime (remediation in progress).',
    });
  } else {
    checks.push({
      name: 'Audit Trail',
      status: config.auditTrailActive ? 'pass' : 'fail',
      message: config.auditTrailActive
        ? 'Audit trail active and recording'
        : 'Audit trail not active — check database connection',
    });
  }

  // Overdue cases
  const kpis = computeKPIs(cases);
  const overdueRatio = kpis.totalOpen > 0 ? kpis.overdueResolution / kpis.totalOpen : 0;
  checks.push({
    name: 'SLA Compliance',
    status: overdueRatio === 0 ? 'pass' : overdueRatio < 0.25 ? 'warn' : 'fail',
    message: overdueRatio === 0
      ? 'No overdue cases'
      : `${kpis.overdueResolution} of ${kpis.totalOpen} open cases overdue (${Math.round(overdueRatio * 100)}%)`,
  });

  // Determine overall status — `unknown` is contagious: any unknown check
  // forces `remediation_in_progress` regardless of other passes/warns/fails.
  const hasUnknown = checks.some((c) => c.status === 'unknown');
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overallStatus: PilotHealthCheck['status'] = hasUnknown
    ? 'remediation_in_progress'
    : hasFail
      ? 'critical'
      : hasWarn
        ? 'degraded'
        : 'healthy';

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const unknownCount = checks.filter((c) => c.status === 'unknown').length;
  const summary =
    unknownCount > 0
      ? `${passCount}/${checks.length} checks passing, ${unknownCount} unmeasured — ${overallStatus}`
      : `${passCount}/${checks.length} checks passing — ${overallStatus}`;

  return {
    status: overallStatus,
    checks,
    summary,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build a complete pilot status summary.
 */
export function buildPilotStatus(
  config: PilotConfiguration,
  cases: CaseRow[],
): PilotStatus {
  const health = runHealthChecks(config, cases);
  const kpis = computeKPIs(cases);
  const worksites = computeWorksiteCounts(cases);
  const assignees = computeAssigneeCounts(cases);

  return {
    phase: 'v0.1-pilot',
    health,
    metrics: {
      totalCases: cases.length,
      openCases: kpis.totalOpen,
      overdueCases: kpis.overdueResolution,
      activeWorksites: worksites.length,
      activeAssignees: assignees.filter((a) => a.assignee !== 'Unassigned').length,
    },
    configuration: config,
  };
}
