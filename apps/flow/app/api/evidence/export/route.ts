/**
 * Flow — /api/evidence/export
 *
 * Returns evidence pack data via platform-evidence-pack.
 * Includes workflow audit events and policy checks.
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { WorkflowAuditEvent } from '@/lib/schemas/workflow-schemas'

const APP = 'flow'
const VERSION = process.env.npm_package_version ?? '0.0.0'
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'
const BUILD_TS = process.env.BUILD_TIMESTAMP ?? new Date().toISOString()

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.evidence.export', { 'http.method': 'GET' }, async () => {
      const auth = await authenticateUser()
      if (!auth.ok) return auth.response

      return NextResponse.json({
        app: APP,
        version: VERSION,
        git_commit: COMMIT,
        build_timestamp: BUILD_TS,
        sbom: { format: 'cyclonedx', available: true },
        policy_checks: {
          quote_generation: 'enforced',
          price_override: 'enforced',
          quote_export: 'enforced',
          po_generation: 'enforced',
          manual_payment_confirmation: 'enforced',
        },
        workflow_audit_events: WorkflowAuditEvent.options,
        lifecycle_statuses: [
          'DRAFT', 'INTERNAL_REVIEW', 'SENT_TO_CLIENT', 'REVISION_REQUESTED',
          'ACCEPTED', 'DEPOSIT_REQUIRED', 'READY_FOR_PO', 'IN_PRODUCTION',
          'SHIPPED', 'DELIVERED', 'CLOSED', 'EXPIRED', 'CANCELLED',
        ],
        timestamp: new Date().toISOString(),
      })
    }),
  )
}
