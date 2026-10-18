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
import { countAuditEvents, countPaymentGateBlocks } from '@/lib/services/governance-metrics-service'
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
        dbAuditEventVolume = await countAuditEvents()
        dbPaymentGateBlocks = await countPaymentGateBlocks()
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
