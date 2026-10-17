/**
 * Case Audit Timeline API
 *
 * GET /api/cases/[caseId]/audit
 *
 * Returns the audit trail for a case, ordered newest-first.
 * PR-031: Case Timeline / Audit Viewer
 */

import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'
import { sql } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { auditDataAccess } from '@/lib/audit-logger'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'
import { getOrganizationIdForUser } from '@/lib/organization-utils'

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const orgId = await getOrganizationIdForUser(userId)

  const { caseId } = await params

  try {
    await requireEntitlement(orgId, 'grievance_case_suite')
    // Canonical audit sink: public.audit_logs (hash-chained, tenant RLS). The case may be addressed by
    // claim number or claim id; audit rows reference the claim id.
    const rows = await withRLSContext({ organizationId: orgId }, async (tx) => {
      const claim = (await tx.execute(
        sql`SELECT claim_id::text AS claim_id FROM claims
          WHERE organization_id = ${orgId}::uuid AND (claim_number = ${caseId} OR claim_id::text = ${caseId})
          LIMIT 1`,
      )) as unknown as { claim_id: string }[]
      if (!claim[0]) return null
      return (await tx.execute(
        sql`SELECT audit_id::text AS "auditId", action, user_id AS "userId",
                 details->>'severity' AS severity, details->>'outcome' AS outcome,
                 COALESCE(details->'details', details) AS metadata,
                 content_hash AS "contentHash", created_at AS "createdAt"
          FROM public.audit_logs
          WHERE organization_id = ${orgId}::uuid
            AND resource_type = 'claims' AND resource_id = ${claim[0].claim_id}
          ORDER BY created_at DESC, id DESC
          LIMIT 200`,
      )) as unknown as Record<string, unknown>[]
    })
    if (!rows) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    // Audit the access itself; a mandatory-audit failure fails the read.
    await auditDataAccess({
      userId,
      organizationId: orgId,
      resource: 'claims',
      resourceId: caseId,
      action: 'list',
      details: { caseId, resultCount: rows.length, view: 'audit_timeline' },
    })

    return NextResponse.json({ caseId, timeline: rows })
  } catch (error) {
    const denied = authorizationDenialResponse(error)
    if (denied) return denied
    return NextResponse.json({ error: 'Failed to retrieve audit timeline' }, { status: 500 })
  }
}
