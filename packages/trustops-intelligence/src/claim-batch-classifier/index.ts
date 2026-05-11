import { z } from 'zod'
import {
  CreditorClassificationSchema,
  ProofOfClaimStatusSchema,
  type CreditorClassification,
  type ProofOfClaimStatus,
} from '@nzila/trustcore-contracts'
import {
  CREDITOR_PRIORITY_ORDER,
  isAdmittedProofOfClaim,
  isOpenProofOfClaim,
} from '@nzila/trustcore-trustops'

/**
 * Pure aggregator for a batch of proofs of claim. Produces deterministic
 * per-class totals + admitted vs open vs other counts. No IO.
 */
export const ClaimBatchItemSchema = z.object({
  classification: CreditorClassificationSchema,
  status: ProofOfClaimStatusSchema,
  amountCents: z.number().int().min(0),
})

export const ClaimBatchInputSchema = z.object({
  items: z.array(ClaimBatchItemSchema),
})

export type ClaimBatchItem = z.infer<typeof ClaimBatchItemSchema>
export type ClaimBatchInput = z.infer<typeof ClaimBatchInputSchema>

export interface ClaimClassBreakdown {
  readonly classification: CreditorClassification
  readonly count: number
  readonly totalAmountCents: number
  readonly admittedAmountCents: number
  readonly percentOfBatch: number
}

export interface ClaimStatusCounts {
  readonly open: number
  readonly admitted: number
  readonly other: number
}

export interface ClaimBatchResult {
  readonly itemCount: number
  readonly totalAmountCents: number
  readonly admittedAmountCents: number
  readonly statusCounts: ClaimStatusCounts
  readonly breakdown: ReadonlyArray<ClaimClassBreakdown>
}

function emptyBreakdown(classification: CreditorClassification): ClaimClassBreakdown {
  return {
    classification,
    count: 0,
    totalAmountCents: 0,
    admittedAmountCents: 0,
    percentOfBatch: 0,
  }
}

export function classifyClaimBatch(input: ClaimBatchInput): ClaimBatchResult {
  const parsed = ClaimBatchInputSchema.parse(input)

  const buckets = new Map<CreditorClassification, ClaimClassBreakdown>()
  for (const cls of CREDITOR_PRIORITY_ORDER) {
    buckets.set(cls, emptyBreakdown(cls))
  }

  let totalAmountCents = 0
  let admittedAmountCents = 0
  const statusCounts: { open: number; admitted: number; other: number } = {
    open: 0,
    admitted: 0,
    other: 0,
  }

  for (const item of parsed.items) {
    const bucket = buckets.get(item.classification) ?? emptyBreakdown(item.classification)
    const next: ClaimClassBreakdown = {
      classification: bucket.classification,
      count: bucket.count + 1,
      totalAmountCents: bucket.totalAmountCents + item.amountCents,
      admittedAmountCents:
        bucket.admittedAmountCents +
        (isAdmittedProofOfClaim(item.status as ProofOfClaimStatus) ? item.amountCents : 0),
      percentOfBatch: 0,
    }
    buckets.set(item.classification, next)

    totalAmountCents += item.amountCents
    if (isAdmittedProofOfClaim(item.status as ProofOfClaimStatus)) {
      admittedAmountCents += item.amountCents
      statusCounts.admitted += 1
    } else if (isOpenProofOfClaim(item.status as ProofOfClaimStatus)) {
      statusCounts.open += 1
    } else {
      statusCounts.other += 1
    }
  }

  const breakdown: ClaimClassBreakdown[] = []
  for (const cls of CREDITOR_PRIORITY_ORDER) {
    const b = buckets.get(cls)
    if (!b || b.count === 0) continue
    breakdown.push({
      ...b,
      percentOfBatch:
        totalAmountCents === 0
          ? 0
          : Math.round((b.totalAmountCents / totalAmountCents) * 10_000) / 100,
    })
  }

  return {
    itemCount: parsed.items.length,
    totalAmountCents,
    admittedAmountCents,
    statusCounts,
    breakdown,
  }
}
