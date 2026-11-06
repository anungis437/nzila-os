/**
 * UnionEyes — /api/governance/telemetry
 *
 * Governance-level observability metrics for procurement / security review
 * and ops dashboards. Backed by real domain tables where possible, with
 * in-process counters as augmentation.
 *
 * Shape mirrors apps/flow's governance telemetry endpoint so platform
 * adapters in Control Plane can consume both consistently.
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { isSystemAdmin } from '@/lib/api-auth-guard'
import { withSpan } from '@nzila/os-core/telemetry'
import { db } from '@/db/db'
import { governanceEvents } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { withSystemContext } from '@/lib/db/with-rls-context'

const SERVICE = 'union-eyes'

// In-process governance counters (augment DB-backed metrics)
let workflowTransitionErrorCount = 0
let evidenceExportCount = 0
let authAnomalyCount = 0

/** Retained for callers; policy denials are not reported by this endpoint (see GET). */
export function recordPolicyDenied() { /* not measured here */ }
export function recordWorkflowTransitionError() { workflowTransitionErrorCount++ }
export function recordEvidenceExport() { evidenceExportCount++ }
export function recordAuthAnomaly() { authAnomalyCount++ }

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.governance.telemetry.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      // null when not measured for this caller (not a platform administrator) or when the database is unavailable: never a fabricated zero.
      let dbAuditEventVolume: number | null = null

      // governance_events is the platform's own corporate-governance log (golden share, reserved-matter votes, mission audits): it has no
      // organization column and holds no union's content, so a platform administrator may see its row count — round 44 defect fix.
      //
      // Policy denials are NOT counted from policy_evaluations here (issue #1118): those rows are organizations' evaluations of their
      // members and actions, and a count across every organization derives tenant activity. A platform title, the system database role
      // or a service key is no standing entitlement to that; cross-organization reporting needs its own separately approved mandate.
      // Until a governed source exists the figure is null ("not measured here"), never a fabricated zero.
      if (await isSystemAdmin()) {
        try {
          const ae = await withSystemContext(async (_tx) =>
            db
              .select({ count: sql<number>`count(*)` })
              .from(governanceEvents)
              .then((rows) => rows[0]),
          )
          dbAuditEventVolume = Number(ae?.count ?? 0)
        } catch {
          // Database unavailable: the volume stays null (not measured).
        }
      }

      return NextResponse.json({
        service: SERVICE,
        policy_denied_count: null,
        workflow_transition_error_count: workflowTransitionErrorCount,
        audit_event_volume: dbAuditEventVolume,
        evidence_export_count: evidenceExportCount,
        auth_anomaly_count: authAnomalyCount,
        generated_at: new Date().toISOString(),
      })
    }),
  )
}
