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
import { withSpan } from '@nzila/os-core/telemetry'
import { db } from '@/db/db'
import { governanceEvents } from '@/db/schema'
import { policyEvaluations } from '@/db/schema/policy-engine-schema'
import { sql } from 'drizzle-orm'

const SERVICE = 'union-eyes'

// In-process governance counters (augment DB-backed metrics)
let policyDeniedCount = 0
let workflowTransitionErrorCount = 0
let evidenceExportCount = 0
let authAnomalyCount = 0

export function recordPolicyDenied() { policyDeniedCount++ }
export function recordWorkflowTransitionError() { workflowTransitionErrorCount++ }
export function recordEvidenceExport() { evidenceExportCount++ }
export function recordAuthAnomaly() { authAnomalyCount++ }

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.governance.telemetry.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      let dbAuditEventVolume = 0
      let dbPolicyDenied = policyDeniedCount

      try {
        const [ae] = await db
          .select({ count: sql<number>`count(*)` })
          .from(governanceEvents)
        dbAuditEventVolume = Number(ae?.count ?? 0)

        const [pd] = await db
          .select({ count: sql<number>`count(*)` })
          .from(policyEvaluations)
          .where(sql`${policyEvaluations.actionTaken} = 'denied' OR ${policyEvaluations.passed} = false`)
        dbPolicyDenied = Number(pd?.count ?? 0) + policyDeniedCount
      } catch {
        // Fall back to in-process counters when DB unavailable.
      }

      return NextResponse.json({
        service: SERVICE,
        policy_denied_count: dbPolicyDenied,
        workflow_transition_error_count: workflowTransitionErrorCount,
        audit_event_volume: dbAuditEventVolume,
        evidence_export_count: evidenceExportCount,
        auth_anomaly_count: authAnomalyCount,
        generated_at: new Date().toISOString(),
      })
    }),
  )
}
