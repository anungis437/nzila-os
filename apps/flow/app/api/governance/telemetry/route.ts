/**
 * Flow — /api/governance/telemetry
 *
 * Exposes governance-level observability metrics:
 * - policy_denied_count
 * - anomaly_count
 * - audit_event_volume
 * - payment_gate_blocks
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { db, flowDomainEvents, flowPayments } from '@nzila/db'
import { sql, eq } from 'drizzle-orm'
import {
  getWorkflowTransitionErrorCount,
  getEventEmissionGapCount,
} from '@/lib/telemetry/counters'

// ── Governance counters (in-process, augmented by DB) ────────────────────────────────────────────────────

let policyDeniedCount = 0
let anomalyCount = 0
let auditEventVolume = 0
let paymentGateBlocks = 0

export function recordPolicyDenied() {
  policyDeniedCount++
}

export function recordAnomaly() {
  anomalyCount++
}

export function recordAuditEvent() {
  auditEventVolume++
}

export function recordPaymentGateBlock() {
  paymentGateBlocks++
}

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.governance.telemetry.get', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      // DB-backed governance metrics with in-process fallback
      let dbAuditEventVolume = auditEventVolume
      let dbPaymentGateBlocks = paymentGateBlocks

      try {
        const [ae] = await db.select({ count: sql<number>`count(*)` }).from(flowDomainEvents)
        dbAuditEventVolume = ae?.count ?? 0
        const [pg] = await db.select({ count: sql<number>`count(*)` }).from(flowPayments).where(eq(flowPayments.status, 'overdue'))
        dbPaymentGateBlocks = pg?.count ?? 0
      } catch {
        // Fallback to in-process counters if DB unavailable
      }

      return NextResponse.json({
        service: 'flow',
        policy_denied_count: policyDeniedCount,
        anomaly_count: anomalyCount,
        audit_event_volume: dbAuditEventVolume,
        payment_gate_blocks: dbPaymentGateBlocks,
        workflow_transition_error_count: getWorkflowTransitionErrorCount(),
        event_emission_gap_count: getEventEmissionGapCount(),
        generated_at: new Date().toISOString(),
      })
    }),
  )
}
