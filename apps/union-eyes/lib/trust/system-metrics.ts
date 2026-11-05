/**
 * Trust Metrics Service
 * 
 * Purpose: Verify and report on system trust infrastructure
 * - Immutability enforcement
 * - RLS (Row-Level Security) isolation
 * - FSM (Finite State Machine) validation
 * - Governance structure
 * - Audit log integrity
 * 
 * Philosophy: Transparency as trust infrastructure
 */

import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import {
  TrustMetrics,
  ImmutabilityMetric,
  RLSMetric,
  FSMMetric,
  GovernanceMetric,
  AuditLogMetric,
} from '@/types/marketing';
import { GovernanceService } from '@/services/governance-service';
import { logger } from '@/lib/logger';
import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { JSXElementConstructor, ReactElement } from 'react';
import { TrustMetricsPdfDocument } from './TrustMetricsPdfDocument';
import { formatTableList } from './format';

/** The history tables whose records must not change. */
const HISTORY_TABLES = ['grievance_transitions', 'approval_records', 'claim_updates', 'audit_logs'] as const;

/**
 * Get comprehensive trust metrics for one organization's trust page.
 *
 * Every database read runs in withRLSContext({ organizationId }): the audit count is that organization's own, and outside a context the
 * handle has no organization and row-level security shows the audit trail as empty. The catalog readings (triggers, policies) are
 * measurements of the schema, the same for every organization.
 */
export async function getTrustMetrics(organizationId: string): Promise<TrustMetrics> {
  const [
    immutability,
    rlsEnforcement,
    fsmValidation,
    governance,
    auditLog,
  ] = await Promise.all([
    getImmutabilityMetrics(organizationId),
    getRLSMetrics(organizationId),
    getFSMMetrics(),
    getGovernanceMetrics(),
    getAuditLogMetrics(organizationId),
  ]);

  return {
    immutability,
    rlsEnforcement,
    fsmValidation,
    governance,
    auditLog,
    lastUpdated: new Date(),
  };
}

/**
 * Verify immutability trigger enforcement: a history table is protected when an enabled trigger named for immutability refuses its updates
 * and an enabled one refuses its deletes. Read from pg_trigger, which every role sees whole (information_schema.triggers hides the triggers of
 * tables the role has no privilege on, which would report a protected table as unprotected). Only the history tables that exist are counted:
 * a table the schema does not have is neither protected nor unprotected.
 */
export async function getImmutabilityMetrics(organizationId: string): Promise<ImmutabilityMetric> {
  try {
    const rows = (await withRLSContext({ organizationId }, (tx) =>
      tx.execute(sql`
        SELECT c.relname::text AS table_name,
               COALESCE(bool_or((t.tgtype & 16) <> 0), false) AS blocks_update,
               COALESCE(bool_or((t.tgtype & 8) <> 0), false) AS blocks_delete
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        LEFT JOIN pg_trigger t
          ON t.tgrelid = c.oid
          AND NOT t.tgisinternal
          AND t.tgenabled <> 'D'
          AND t.tgname ILIKE '%immutab%'
        WHERE c.relkind IN ('r', 'p')
          AND c.relname IN (${sql.join(HISTORY_TABLES.map((table) => sql`${table}`), sql`, `)})
        GROUP BY c.relname
        ORDER BY c.relname
      `),
    )) as unknown as Array<{ table_name: string; blocks_update: boolean; blocks_delete: boolean }>;

    const tablesProtected = rows.filter((row) => row.blocks_update && row.blocks_delete).map((row) => row.table_name);
    const triggersActive = rows.length > 0 && tablesProtected.length === rows.length;

    return {
      status: rows.length === 0 ? 'unknown' : triggersActive ? 'active' : tablesProtected.length > 0 ? 'degraded' : 'error',
      verification: triggersActive,
      lastCheck: new Date(),
      description:
        rows.length === 0
          ? 'None of the history tables exists to be verified'
          : `${tablesProtected.length} of ${rows.length} history tables have enabled triggers that refuse both updates and deletes`,
      triggersActive,
      tablesProtected,
      // Nothing records a refused modification, so there is no figure to report.
      violationAttempts: null,
      lastAudit: new Date(),
    };
  } catch (error) {
    logger.error('Failed to check immutability metrics', error);
    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description: 'Unable to verify immutability status',
      triggersActive: false,
      tablesProtected: [],
      violationAttempts: null,
      lastAudit: new Date(),
    };
  }
}

/**
 * Verify RLS (Row-Level Security) coverage: the share of the tables that carry an organization column (organization_id or org_id) that have
 * row-level security enabled, and the policies that enforce it.
 */
export async function getRLSMetrics(organizationId: string): Promise<RLSMetric> {
  try {
    const { tenantTables, policies } = await withRLSContext({ organizationId }, async (tx) => ({
      tenantTables: (await tx.execute(sql`
        SELECT c.relname::text AS table_name, c.relrowsecurity AS enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND EXISTS (
            SELECT 1 FROM pg_attribute a
            WHERE a.attrelid = c.oid
              AND a.attname IN ('organization_id', 'org_id')
              AND a.attnum > 0
              AND NOT a.attisdropped
          )
        ORDER BY c.relname
      `)) as unknown as Array<{ table_name: string; enabled: boolean }>,
      policies: (await tx.execute(sql`
        SELECT COUNT(*)::int AS count FROM pg_policies WHERE schemaname = 'public'
      `)) as unknown as Array<{ count: number }>,
    }));

    const tablesProtected = tenantTables.filter((table) => table.enabled).map((table) => table.table_name);
    const policiesActive = Number(policies[0]?.count ?? 0);
    const lastPolicyCheck = new Date();

    if (tenantTables.length === 0) {
      return {
        status: 'unknown',
        verification: false,
        lastCheck: lastPolicyCheck,
        description: 'No table with an organization column was found to measure',
        policiesActive,
        orgIsolation: 'Unknown',
        lastPolicyCheck,
        tablesProtected,
      };
    }

    const everyTableProtected = tablesProtected.length === tenantTables.length;
    return {
      status: everyTableProtected ? 'active' : 'degraded',
      verification: everyTableProtected,
      lastCheck: lastPolicyCheck,
      description: `${tablesProtected.length} of ${tenantTables.length} tables that carry an organization column enforce row-level security`,
      policiesActive,
      // Rounded down: a share below 100% is never shown as 100%.
      orgIsolation: `${Math.floor((tablesProtected.length / tenantTables.length) * 100)}%`,
      lastPolicyCheck,
      tablesProtected,
    };
  } catch (error) {
    logger.error('Failed to check RLS metrics', error);
    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description: 'Unable to verify RLS status',
      policiesActive: 0,
      orgIsolation: 'Unknown',
      lastPolicyCheck: new Date(),
      tablesProtected: [],
    };
  }
}

/**
 * Verify FSM enforcement
 */
export async function getFSMMetrics(): Promise<FSMMetric> {
  try {
    // FSM compliance/blocked-transition tracking is not wired up to a metrics
    // table yet. Report 'unknown' rather than fake 100% compliance — a trust
    // dashboard claiming perfect FSM enforcement without measurement is worse
    // than reporting "unknown".
    logger.warn('getFSMMetrics: no metrics source wired; reporting unknown rather than synthetic 100% compliance');

    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description:
        'FSM enforcement metrics source is not configured. Compliance and blocked-transition counts are not measured.',
      invalidTransitionsBlocked: 0,
      complianceRate: 0,
      lastValidation: new Date(),
    };
  } catch (error) {
    logger.error('Failed to check FSM metrics', error);
    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description: 'Unable to verify FSM status',
      invalidTransitionsBlocked: 0,
      complianceRate: 0,
      lastValidation: new Date(),
    };
  }
}

/**
 * Get governance structure metrics
 */
export async function getGovernanceMetrics(): Promise<GovernanceMetric> {
  try {
    const governance = new GovernanceService();
    const goldenShareStatus = await governance.checkGoldenShareStatus();

    return {
      status: goldenShareStatus.exists ? 'active' : 'degraded',
      verification: goldenShareStatus.exists,
      lastCheck: new Date(),
      description: 'Democratic oversight with Class B voting rights',
      goldenShareActive: goldenShareStatus.exists,
      goldenShareHolder: goldenShareStatus.holder || 'None',
      lastElectionDate: goldenShareStatus.lastElection,
      reservedMattersProtection: goldenShareStatus.exists ? 'active' : 'inactive',
      upcomingElection: undefined, // Would calculate based on election cycle
    };
  } catch (error) {
    logger.error('Failed to check governance metrics', error);
    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description: 'Unable to verify governance status',
      goldenShareActive: false,
      goldenShareHolder: 'Unknown',
      reservedMattersProtection: 'inactive',
    };
  }
}

/**
 * Get audit log metrics: the audit events recorded for the organization in the last 30 days. The count is the organization's own, read
 * in its context (audit_logs is a tenant table): through the module-level handle the count was of an empty table.
 */
export async function getAuditLogMetrics(organizationId: string): Promise<AuditLogMetric> {
  try {
    const rows = (await withRLSContext({ organizationId }, (tx) =>
      tx.execute(sql`
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE organization_id = ${organizationId}
          AND created_at > NOW() - INTERVAL '30 days'
      `),
    )) as unknown as Array<{ count: number }>;

    const eventsLogged = Number(rows[0]?.count ?? 0);

    // No archive is recorded: the legacy audit_log relation this once counted does not exist, so an archived-event count and a last-archive date are not reported.
    return {
      status: 'active',
      verification: true,
      lastCheck: new Date(),
      description: 'Audit events recorded for this organization in the last 30 days',
      eventsLogged,
      retentionPolicy: '7 years',
    };
  } catch (error) {
    logger.error('Failed to check audit log metrics', error);
    return {
      status: 'unknown',
      verification: false,
      lastCheck: new Date(),
      description: 'Unable to verify audit log status',
      eventsLogged: 0,
      retentionPolicy: '7 years',
    };
  }
}

/**
 * Export trust metrics as PDF (for investor/CIO presentations)
 */
export async function exportTrustMetricsPDF(metrics: TrustMetrics): Promise<Blob> {
  const element = React.createElement(
    TrustMetricsPdfDocument,
    { metrics },
  ) as ReactElement<DocumentProps, string | JSXElementConstructor<any>>;
  const buffer = await renderToBuffer(element);
  return new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
}

/**
 * Generate trust dashboard summary for organizational stakeholders
 */
export function generateTrustSummary(metrics: TrustMetrics): string {
  const sections = [
    '# UnionEyes Trust Infrastructure Report',
    `Generated: ${metrics.lastUpdated.toISOString()}`,
    '',
    '## Immutability Enforcement',
    `Status: ${metrics.immutability.status.toUpperCase()}`,
    `Tables Protected: ${formatTableList(metrics.immutability.tablesProtected)}`,
    `Violation Attempts: ${metrics.immutability.violationAttempts ?? 'not measured'}`,
    '',
    '## RLS (Row-Level Security)',
    `Status: ${metrics.rlsEnforcement.status.toUpperCase()}`,
    `Policies Active: ${metrics.rlsEnforcement.policiesActive}`,
    `Org Isolation: ${metrics.rlsEnforcement.orgIsolation}`,
    '',
    '## FSM Validation',
    `Status: ${metrics.fsmValidation.status.toUpperCase()}`,
    `Compliance Rate: ${metrics.fsmValidation.complianceRate}%`,
    `Invalid Transitions Blocked: ${metrics.fsmValidation.invalidTransitionsBlocked}`,
    '',
    '## Governance Structure',
    `Golden Share: ${metrics.governance.goldenShareActive ? 'Active' : 'Inactive'}`,
    `Holder: ${metrics.governance.goldenShareHolder}`,
    `Reserved Matters Protection: ${metrics.governance.reservedMattersProtection}`,
    '',
    '## Audit Log',
    `Events Logged (30 days): ${metrics.auditLog.eventsLogged.toLocaleString()}`,
    `Retention Policy: ${metrics.auditLog.retentionPolicy}`,
  ];

  return sections.join('\n');
}

/**
 * Example usage:
 * 
 * // Get all metrics for the signed-in user's organization
 * const metrics = await getTrustMetrics(organizationId);
 * 
 * // Display on trust dashboard
 * <SystemStatusGrid systems={[
 *   {
 *     system: "Immutability Enforcement",
 *     status: metrics.immutability.status,
 *     description: metrics.immutability.description,
 *     metadata: [
 *       { label: "Tables Protected", value: metrics.immutability.tablesProtected.length },
 *       { label: "Violations Blocked", value: metrics.immutability.violationAttempts ?? "—" }
 *     ]
 *   },
 *   // ... other systems
 * ]} />
 * 
 * // Generate summary for export
 * const summary = generateTrustSummary(metrics);
 */
