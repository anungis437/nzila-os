/**
 * TrustCore — Audit Export API
 *
 * POST /api/export/audit
 *
 * Generates a full audit report for the authenticated org.
 * Supports JSON and PDF formats.
 *
 * Access: org_admin only (RBAC enforced)
 * Plan:   PRO / PREMIUM required
 *
 * Body: { format: 'json' | 'pdf' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { generateComplianceReport } from '@/lib/compliance/report'
import { listTrustcoreEvidenceEvents } from '@nzila/db/queries/trustcore'
import { generateAuditPdf } from '@/lib/compliance/pdf'
import { requireFeature, FeatureGateError } from '@/lib/billing/requireFeature'

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (request: NextRequest, ctx) => {
    // ── Billing gate ──────────────────────────────────────────────────────
    try {
      await requireFeature(ctx.orgId, 'audit_export')
    } catch (err) {
      if (err instanceof FeatureGateError) {
        return NextResponse.json(err.toResponse(), { status: 403 })
      }
      throw err
    }

    let format: 'json' | 'pdf' = 'json'
    try {
      const body = await request.json() as { format?: unknown }
      if (body.format === 'pdf') format = 'pdf'
    } catch {
      // default to json
    }

    const [report, evidenceEvents] = await Promise.all([
      generateComplianceReport(ctx.orgId),
      listTrustcoreEvidenceEvents(ctx.orgId),
    ])

    if (format === 'pdf') {
      const pdfBuffer = await generateAuditPdf(report)
      // Ensure ArrayBuffer (not SharedArrayBuffer) for Blob compatibility in TS 6+.
      const pdfArrayBuffer: ArrayBuffer = pdfBuffer.buffer.slice(
        pdfBuffer.byteOffset,
        pdfBuffer.byteOffset + pdfBuffer.byteLength,
      ) as ArrayBuffer
      return new Response(new Blob([pdfArrayBuffer], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="trustcore-audit-${ctx.orgId}-${Date.now()}.pdf"`,
          'Cache-Control': 'no-store',
        },
      }) as NextResponse
    }

    // JSON export — full structured document
    const exportDoc = {
      exportedAt: new Date().toISOString(),
      format: 'json',
      framework: 'law-25',
      organization: {
        orgId: ctx.orgId,
        privacyOfficerName: report.privacyOfficerName,
        privacyOfficerEmail: report.privacyOfficerEmail,
        privacyOfficerRole: report.privacyOfficerRole,
        programStatus: report.programStatus,
        lastReviewedAt: report.lastReviewedAt,
      },
      compliance: {
        score: report.score,
        confidence: report.confidence,
        status: report.status,
        evaluatedAt: report.evaluatedAt,
        auditReadyStatement: report.auditReadyStatement,
      },
      summary: report.summary,
      risks: report.evaluation.risks,
      dataInventory: report.inputs.assets,
      pias: report.inputs.pias,
      incidents: report.inputs.incidents,
      dsrRequests: report.inputs.dsrRequests,
      vendors: report.inputs.vendors,
      evidence: evidenceEvents,
      evidenceStatement:
        'This report is generated from a system with immutable audit logging. All actions are recorded with timestamps and attribution.',
    }

    return NextResponse.json(
      { success: true, data: exportDoc },
      {
        headers: {
          'Content-Disposition': `attachment; filename="trustcore-audit-${ctx.orgId}-${Date.now()}.json"`,
          'Cache-Control': 'no-store',
        },
      },
    )
  },
)
