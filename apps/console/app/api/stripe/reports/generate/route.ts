// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/reports/generate — Generate monthly Stripe reports
 *
 * Generates revenue_summary, payout_recon, refunds_summary, disputes_summary.
 * Uploads to Azure Blob via @nzila/blob, creates documents + stripeReports rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateStripeReports } from '@nzila/payments-stripe/reports'
import { authenticateUser } from '@/lib/api-guards'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'

const GenerateReportsSchema = z.object({
  entityId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  periodId: z.string().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = GenerateReportsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { entityId, startDate, endDate, periodId } = parsed.data

  try {
    const artifacts = await generateStripeReports({
      entityId,
      startDate,
      endDate,
      periodId,
      actorClerkUserId: auth.userId,
    })

    // Audit each report generated
    for (const artifact of artifacts) {
      await recordAuditEvent({
        entityId,
        actorClerkUserId: auth.userId,
        actorRole: auth.platformRole,
        action: AUDIT_ACTIONS.DATA_EXPORT,
        targetType: 'stripe_report',
        targetId: artifact.reportId,
        afterJson: {
          reportType: artifact.reportType,
          blobPath: artifact.blobPath,
          sha256: artifact.sha256,
          documentId: artifact.documentId,
          startDate,
          endDate,
          periodId,
        },
      })
    }

    return NextResponse.json(
      {
        reports: artifacts.map((a) => ({
          reportType: a.reportType,
          reportId: a.reportId,
          documentId: a.documentId,
          blobPath: a.blobPath,
          sha256: a.sha256,
          sizeBytes: a.sizeBytes,
        })),
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[stripe/reports/generate] Error:', err)
    return NextResponse.json(
      { error: 'Failed to generate reports' },
      { status: 500 },
    )
  }
}
