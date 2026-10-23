/**
 * Case Audit Timeline API
 *
 * GET /api/cases/[caseId]/audit
 *
 * Returns the audit trail for a case, ordered newest-first.
 * PR-031: Case Timeline / Audit Viewer
 */

import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { auditDataAccess } from '@/lib/audit-logger'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'
import { getCaseActor, findReadableCase, requireCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization'

export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params
  try {
    const actor = await getCaseActor()
    const { userId, organizationId: orgId } = actor
    await requireCaseAction(actor, 'note_add_internal', caseId)
    await requireEntitlement(orgId, 'grievance_case_suite')
    // Canonical audit sink: public.audit_logs (hash-chained, tenant RLS). The case may be addressed by
    // claim number or claim id; audit rows reference the claim id.
    const rows = await withRLSContext({ organizationId: orgId }, async (tx) => {
      const claim = await findReadableCase(tx, actor, caseId)
      if (!claim) return null
      return (await tx.execute(
        sql`SELECT audit_id::text AS "auditId", action, user_id AS "userId",
                 details->>'severity' AS severity, details->>'outcome' AS outcome,
                 COALESCE(details->'details', details) AS metadata,
                 content_hash AS "contentHash", created_at AS "createdAt"
          FROM public.audit_logs
          WHERE organization_id = ${orgId}::uuid
            AND resource_type = 'claims' AND resource_id = ${claim.claimId}
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
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    return NextResponse.json({ error: 'Failed to retrieve audit timeline' }, { status: 500 })
  }
}
