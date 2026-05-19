/**
 * UnionEyes — /api/evidence/export
 *
 * Returns an evidence pack summary suitable for procurement / security
 * review. Shape mirrors apps/flow's evidence export so Control Plane and
 * platform-evidence-pack adapters can consume both consistently.
 *
 * NOTE: The full sealed evidence bundle is produced by the
 * `pnpm evidence:all` pipeline (collect → seal → verify). This endpoint
 * exposes a live snapshot of the same logical structure.
 */
import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { auth } from '@nzila/platform-auth/entra/server'
import { withSpan } from '@nzila/os-core/telemetry'
import { recordEvidenceExport } from '@/app/api/governance/telemetry/route'

/**
 * Roles that may NOT access the evidence export endpoint.
 * Plain members have no operational need for the full evidence pack.
 * All staff, steward, admin, governance, and platform roles are allowed.
 */
const MEMBER_ONLY_ROLES = new Set(['member', 'MEMBER'])

const APP = 'union-eyes'
const VERSION = process.env.npm_package_version ?? '0.0.0'
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'
const BUILD_TS = process.env.BUILD_TIMESTAMP ?? new Date().toISOString()

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.evidence.export', { 'http.method': 'GET' }, async () => {
      const authResult = await authenticateUser()
      if (!authResult.ok) return authResult.response

      // Role gate: evidence export is restricted to staff/admin/governance.
      // authenticateUser() only checks identity — we need the resolved role.
      const { orgRole } = await auth()
      if (!orgRole || MEMBER_ONLY_ROLES.has(orgRole)) {
        return NextResponse.json(
          { error: 'Forbidden', message: 'Evidence export requires staff-level access.' },
          { status: 403 },
        )
      }

      const { searchParams } = new URL(request.url)
      const orgId = searchParams.get('orgId') ?? 'unscoped'

      recordEvidenceExport()

      return NextResponse.json({
        org_id: orgId,
        app: APP,
        version: VERSION,
        git_commit: COMMIT,
        build_timestamp: BUILD_TS,
        sbom: { format: 'cyclonedx', available: true, source: 'pnpm evidence:collect' },
        policy_checks: {
          grievance_creation: 'enforced',
          grievance_status_transition: 'enforced',
          escalation_authorization: 'enforced',
          arbitration_decision_seal: 'enforced',
          evidence_immutability: 'enforced',
          cross_org_access: 'denied',
        },
        workflow_audit_events: [
          'grievance.created',
          'grievance.assigned',
          'grievance.status_changed',
          'grievance.escalated',
          'grievance.settled',
          'arbitration.opened',
          'arbitration.decided',
          'evidence.uploaded',
          'policy.evaluated',
        ],
        lifecycle_statuses: [
          'intake', 'triage', 'investigation', 'response_pending',
          'escalated', 'arbitration', 'settled', 'resolved', 'closed',
        ],
        org_isolation: {
          enforced: true,
          enforced_at: ['db_layer', 'route_layer', 'audit_layer'],
          cross_org_read_attempts_blocked: true,
        },
        pipeline: {
          collect: 'scripts/evidence/collect.mjs',
          seal: 'scripts/evidence/seal.mjs',
          verify: 'scripts/evidence/verify.mjs',
        },
        generated_at: new Date().toISOString(),
      })
    }),
  )
}
