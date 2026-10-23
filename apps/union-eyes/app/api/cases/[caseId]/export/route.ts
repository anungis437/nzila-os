/**
 * Evidence Export API
 *
 * GET /api/cases/[caseId]/export
 *
 * Returns a sealed JSON evidence pack for the given case.
 * PR-032: Evidence Export + Seal Verification
 */

import { NextResponse } from 'next/server'
import { claims, claimUpdates } from '@/db/schema'
import { auditLogs } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { buildEvidencePackage, buildEvidenceZip, buildEvidencePdf } from '@/lib/evidence-export'
import { auditCaseExport } from '@/lib/audited-case-mutations'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'
import { recordUnionEyesEvidenceExport } from '@/lib/pilot-metrics'
import { getCaseActor, findReadableCase, caseHistoryVisibility, requireCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { readCanonicalCaseAudit } from '@/lib/cases/case-evidence-query'
import { claimHistoryReference, publicClaimHistory } from '@/lib/cases/claim-history-reference'

export async function GET(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId: reference } = await params
  const url = new URL(request.url)
  const format = (url.searchParams.get('format') ?? 'json').toLowerCase()
  const envelope = url.searchParams.get('envelope') === 'true'
  const verify = url.searchParams.get('verify') === 'true'

  try {
    const actor = await getCaseActor()
    const { userId, organizationId: orgId } = actor
    await requireCaseAction(actor, 'case_export', reference)
    await requireEntitlement(orgId, 'grievance_case_suite')
    const records = await withRLSContext(async (tx) => {
      const readable = await findReadableCase(tx, actor, reference)
      if (!readable) return null
      const caseId = readable.claimId
      const [caseRows, noteRows] = await Promise.all([
        tx.select().from(claims).where(and(eq(claims.claimId, caseId), eq(claims.organizationId, orgId))).limit(1),
        tx
          .select()
          .from(claimUpdates)
          .where(and(eq(claimUpdates.claimId, claimHistoryReference(caseId)), caseHistoryVisibility(actor)))
          .orderBy(desc(claimUpdates.createdAt)),
      ])
      // V2 writes hash-chained public records; the legacy audit_security table
      // is deliberately inaccessible to the canonical runtime database role.
      const auditRows = currentStateContextEnabled()
        ? await readCanonicalCaseAudit(tx, orgId, caseId)
        : await tx.select().from(auditLogs)
          .where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.resourceType, 'claims'), eq(auditLogs.resourceId, caseId)))
          .orderBy(desc(auditLogs.createdAt))
      return { caseId, caseRows, noteRows, auditRows }
    })

    if (!records || records.caseRows.length === 0) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }
    const { caseId, caseRows, noteRows, auditRows } = records

    const evidenceInput = {
      exportedBy: userId,
      caseId,
      organizationId: orgId,
      caseRecord: caseRows[0] as any as Record<string, unknown>,
      notes: noteRows.map(note => publicClaimHistory(note, caseId)) as any as Record<string, unknown>[],
      auditTrail: auditRows as any as Record<string, unknown>[],
    }

    const packageEnvelope = buildEvidencePackage(evidenceInput)
    const pack = packageEnvelope.pack

    // Audit the export event
    if (format !== 'json' && format !== 'zip' && format !== 'pdf') {
      return NextResponse.json(
        { error: `Unsupported format '${format}'. Use json, zip, or pdf.` },
        { status: 400 },
      )
    }

    await auditCaseExport({
      userId,
      organizationId: orgId,
      caseId,
      format: format as 'json' | 'zip' | 'pdf',
    })

    const traceId = request.headers.get('x-trace-id') ?? crypto.randomUUID()
    recordUnionEyesEvidenceExport(orgId, caseId, userId, traceId).catch(() => {
      // Do not fail export path on observability errors.
    })

    if (format === 'zip') {
      const zip = await buildEvidenceZip(packageEnvelope)
      return new NextResponse(new Uint8Array(zip), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="evidence-${caseId}.zip"`,
        },
      })
    }

    if (format === 'pdf') {
      const pdf = await buildEvidencePdf(packageEnvelope)
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="evidence-${caseId}.pdf"`,
        },
      })
    }

    if (envelope || verify) {
      return NextResponse.json(
        {
          manifest: packageEnvelope.manifest,
          pack,
          verification: packageEnvelope.verification,
        },
        {
          headers: {
            'Content-Disposition': `attachment; filename="evidence-${caseId}.json"`,
          },
        },
      )
    }

    return NextResponse.json(pack, {
      headers: {
        'Content-Disposition': `attachment; filename="evidence-${caseId}.json"`,
      },
    })
  } catch (error) {
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    return NextResponse.json({ error: 'Failed to export evidence' }, { status: 500 })
  }
}
