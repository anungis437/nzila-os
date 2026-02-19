/**
 * @nzila/tools-runtime — Stripe Tool
 *
 * Wraps the existing @nzila/payments-stripe report generator
 * with idempotency checks and tool call logging.
 */
import { db } from '@nzila/db'
import { stripeReports } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { generateStripeReports } from '@nzila/payments-stripe'
import type { ReportArtifact } from '@nzila/payments-stripe'
import { createToolCallEntry, type ToolCallEntry } from './sanitize'
import type { FinanceStripeMonthlyReportsProposal } from '@nzila/ai-core/schemas'

// ── Idempotency key ────────────────────────────────────────────────────────

function buildIdempotencyKey(proposal: FinanceStripeMonthlyReportsProposal): string {
  return [
    proposal.entityId,
    proposal.period.periodLabel,
    proposal.outputs.sort().join(','),
    proposal.ventureId ?? 'all',
  ].join('::')
}

// ── Check for existing reports ──────────────────────────────────────────────

async function findExistingReports(
  entityId: string,
  startDate: string,
  endDate: string,
): Promise<ReportArtifact[]> {
  const existing = await db
    .select()
    .from(stripeReports)
    .where(
      and(
        eq(stripeReports.entityId, entityId),
        eq(stripeReports.startDate, startDate),
        eq(stripeReports.endDate, endDate),
      ),
    )

  if (existing.length === 0) return []

  // Return as ReportArtifact shape (partial — we have the IDs)
  return existing.map((r) => ({
    reportType: r.reportType as ReportArtifact['reportType'],
    blobPath: '', // not stored in stripeReports directly
    sha256: r.sha256,
    sizeBytes: 0,
    documentId: r.documentId ?? '',
    reportId: r.id,
  }))
}

// ── Generate monthly reports ────────────────────────────────────────────────

export interface StripeReportResult {
  artifacts: ReportArtifact[]
  idempotencyKey: string
  wasIdempotent: boolean
  toolCalls: ToolCallEntry[]
}

/**
 * Generate Stripe monthly reports for a proposal.
 * Idempotent: if reports already exist for the period, returns them.
 */
export async function generateMonthlyReports(
  proposal: FinanceStripeMonthlyReportsProposal,
  actorClerkUserId: string,
): Promise<StripeReportResult> {
  const idempotencyKey = buildIdempotencyKey(proposal)
  const toolCalls: ToolCallEntry[] = []

  // Check idempotency
  const startedAt = new Date()
  const existing = await findExistingReports(
    proposal.entityId,
    proposal.period.startDate,
    proposal.period.endDate,
  )

  if (existing.length > 0) {
    const finishedAt = new Date()
    toolCalls.push(
      createToolCallEntry({
        toolName: 'stripeTool.idempotencyCheck',
        startedAt,
        finishedAt,
        inputs: { idempotencyKey },
        outputs: { existingCount: existing.length },
        status: 'success',
      }),
    )
    return {
      artifacts: existing,
      idempotencyKey,
      wasIdempotent: true,
      toolCalls,
    }
  }

  // Generate new reports via existing function
  const genStartedAt = new Date()
  try {
    const artifacts = await generateStripeReports({
      entityId: proposal.entityId,
      startDate: proposal.period.startDate,
      endDate: proposal.period.endDate,
      periodId: proposal.period.periodId,
      actorClerkUserId,
    })

    const genFinishedAt = new Date()
    toolCalls.push(
      createToolCallEntry({
        toolName: 'stripeTool.generateReports',
        startedAt: genStartedAt,
        finishedAt: genFinishedAt,
        inputs: {
          entityId: proposal.entityId,
          startDate: proposal.period.startDate,
          endDate: proposal.period.endDate,
          outputs: proposal.outputs,
        },
        outputs: {
          artifactCount: artifacts.length,
          reportTypes: artifacts.map((a) => a.reportType),
        },
        status: 'success',
      }),
    )

    return {
      artifacts,
      idempotencyKey,
      wasIdempotent: false,
      toolCalls,
    }
  } catch (err) {
    const genFinishedAt = new Date()
    toolCalls.push(
      createToolCallEntry({
        toolName: 'stripeTool.generateReports',
        startedAt: genStartedAt,
        finishedAt: genFinishedAt,
        inputs: {
          entityId: proposal.entityId,
          startDate: proposal.period.startDate,
          endDate: proposal.period.endDate,
        },
        outputs: {},
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    throw err
  }
}
