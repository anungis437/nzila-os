/**
 * CUPE Pilot Admin — Status & Health
 *
 * PR-060: Admin console completion — provides a health check
 * endpoint and status summary for the CUPE pilot deployment.
 */

import type { CaseRow } from './dashboard-metrics';
import { computeKPIs, computeWorksiteCounts, computeAssigneeCounts } from './dashboard-metrics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PilotHealthCheck {
  status: 'healthy' | 'degraded' | 'critical';
  checks: HealthCheckItem[];
  summary: string;
  timestamp: string;
}

export interface HealthCheckItem {
  name: string;
  status: 'pass' | 'warn' | 'fail';
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

export interface PilotConfiguration {
  vocabularyLoaded: boolean;
  orgConfigured: boolean;
  usersInvited: number;
  worksitesConfigured: number;
  slaThresholdsSet: boolean;
  auditTrailActive: boolean;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Run pilot health checks against current state.
 */
export function runHealthChecks(config: PilotConfiguration, cases: CaseRow[]): PilotHealthCheck {
  const checks: HealthCheckItem[] = [];

  // Vocabulary
  checks.push({
    name: 'Vocabulary',
    status: config.vocabularyLoaded ? 'pass' : 'fail',
    message: config.vocabularyLoaded
      ? 'CUPE vocabulary loaded and accessible'
      : 'CUPE vocabulary not loaded — run seed endpoint',
  });

  // Org
  checks.push({
    name: 'Organization',
    status: config.orgConfigured ? 'pass' : 'fail',
    message: config.orgConfigured
      ? 'Pilot organization configured'
      : 'No pilot organization — create via admin console',
  });

  // Users
  checks.push({
    name: 'Users',
    status: config.usersInvited >= 2 ? 'pass' : config.usersInvited >= 1 ? 'warn' : 'fail',
    message: `${config.usersInvited} user(s) invited (minimum 2 recommended)`,
  });

  // Worksites
  checks.push({
    name: 'Worksites',
    status: config.worksitesConfigured >= 1 ? 'pass' : 'fail',
    message: `${config.worksitesConfigured} worksite(s) configured`,
  });

  // SLA
  checks.push({
    name: 'SLA Thresholds',
    status: config.slaThresholdsSet ? 'pass' : 'warn',
    message: config.slaThresholdsSet
      ? 'SLA thresholds configured'
      : 'Using default SLA thresholds (3/7/14/30 days)',
  });

  // Audit trail
  checks.push({
    name: 'Audit Trail',
    status: config.auditTrailActive ? 'pass' : 'fail',
    message: config.auditTrailActive
      ? 'Audit trail active and recording'
      : 'Audit trail not active — check database connection',
  });

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

  // Determine overall status
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overallStatus = hasFail ? 'critical' : hasWarn ? 'degraded' : 'healthy';

  const passCount = checks.filter((c) => c.status === 'pass').length;
  const summary = `${passCount}/${checks.length} checks passing — ${overallStatus}`;

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
