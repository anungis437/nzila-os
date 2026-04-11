/**
 * @nzila/payments-stripe — Evidence pack builder
 *
 * Collects Stripe report artifacts for a given entity + period
 * and builds an EvidencePackRequest compatible with the existing
 * processEvidencePack() pipeline from @nzila/os-core.
 *
 * This module does NOT create a second evidence pack mechanism.
 * It produces a request that feeds directly into the OS-Core
 * evidence system.
 */
import { db } from '@nzila/db'
import { stripeReports, documents } from '@nzila/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { downloadBuffer } from '@nzila/blob'
import type { StripeReportType } from './types'

// Re-export compatible input type
export interface StripeEvidencePackInput {
  orgId: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  periodLabel: string // e.g. "2025-03"
  createdBy: string // auth userId or "system"
}

export interface StripeEvidenceArtifact {
  artifactId: string
  artifactType: string
  filename: string
  buffer: Buffer
  contentType: string
  retentionClass: 'PERMANENT' | '7_YEARS' | '3_YEARS' | '1_YEAR'
  classification: 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
  description: string
}

/**
 * Collect all Stripe reports for an entity+period and return them
 * as artifact descriptors ready for the OS-Core evidence pack pipeline.
 *
 * Usage:
 * ```ts
 * import { collectStripeEvidenceArtifacts } from '@nzila/payments-stripe/evidence'
 * import { processEvidencePack } from '@nzila/os-core/evidence/generate-evidence-index'
 *
 * const artifacts = await collectStripeEvidenceArtifacts({ orgId, startDate, endDate, periodLabel, createdBy })
 * await processEvidencePack({
 *   packId: `STRIPE-${periodLabel}`,
 *   orgId,
 *   controlFamily: 'integrity',
 *   eventType: 'period-close',
 *   eventId: `stripe-${periodLabel}`,
 *   blobContainer: 'evidence',
 *   summary: `Stripe payment evidence pack for ${periodLabel}`,
 *   controlsCovered: ['INT-06', 'INT-07'],
 *   createdBy,
 *   artifacts,
 * })
 * ```
 */
export async function collectStripeEvidenceArtifacts(
  input: StripeEvidencePackInput,
): Promise<StripeEvidenceArtifact[]> {
  const { orgId, startDate, endDate, periodLabel, createdBy } = input

  // Fetch stripe reports for the date range
  const reports = await db
    .select({
      id: stripeReports.id,
      reportType: stripeReports.reportType,
      startDate: stripeReports.startDate,
      endDate: stripeReports.endDate,
      documentId: stripeReports.documentId,
      sha256: stripeReports.sha256,
    })
    .from(stripeReports)
    .where(
      and(
        eq(stripeReports.orgId, orgId),
        gte(stripeReports.startDate, startDate),
        lte(stripeReports.endDate, endDate),
      ),
    )

  if (reports.length === 0) {
    return []
  }

  const artifacts: StripeEvidenceArtifact[] = []

  for (const report of reports) {
    if (!report.documentId) continue

    // Fetch the document row to get the blob path
    const [doc] = await db
      .select({
        blobContainer: documents.blobContainer,
        blobPath: documents.blobPath,
        contentType: documents.contentType,
      })
      .from(documents)
      .where(eq(documents.id, report.documentId))
      .limit(1)

    if (!doc) continue

    // Download the artifact from blob storage
    const buffer = await downloadBuffer(doc.blobContainer, doc.blobPath)

    const reportTypeLabel = report.reportType.replace(/_/g, '-')
    const filename = `stripe-${reportTypeLabel}-${periodLabel}.json`

    artifacts.push({
      artifactId: `stripe-${reportTypeLabel}-${report.id}`,
      artifactType: `stripe-${reportTypeLabel}`,
      filename,
      buffer,
      contentType: doc.contentType,
      retentionClass: '7_YEARS',
      classification: 'INTERNAL',
      description: `Stripe ${report.reportType.replace(/_/g, ' ')} for ${report.startDate} to ${report.endDate}`,
    })
  }

  return artifacts
}

/**
 * Build a complete evidence pack request object for Stripe reports.
 * Returns a plain object matching the EvidencePackRequest shape
 * from @nzila/os-core.
 */
export async function buildStripeEvidencePackRequest(
  input: StripeEvidencePackInput,
): Promise<{
  packId: string
  orgId: string
  controlFamily: 'integrity'
  eventType: 'period-close'
  eventId: string
  blobContainer: 'evidence'
  summary: string
  controlsCovered: string[]
  createdBy: string
  artifacts: StripeEvidenceArtifact[]
} | null> {
  const artifacts = await collectStripeEvidenceArtifacts(input)

  if (artifacts.length === 0) {
    return null
  }

  return {
    packId: `STRIPE-${input.periodLabel}`,
    orgId: input.orgId,
    controlFamily: 'integrity',
    eventType: 'period-close',
    eventId: `stripe-period-close-${input.periodLabel}`,
    blobContainer: 'evidence',
    summary: `Stripe payment evidence pack for period ${input.periodLabel} (${input.startDate} to ${input.endDate})`,
    controlsCovered: ['INT-06', 'INT-07'],
    createdBy: input.createdBy,
    artifacts,
  }
}
