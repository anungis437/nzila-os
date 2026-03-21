/**
 * @nzila/zonga-rights — Payout Proof
 *
 * Generates signed proof records for every payout disbursement.
 * Proofs are immutable, timestamped, and hashable for audit verification.
 *
 * All monetary amounts are in integer minor units (cents).
 */

// ── Types ─────────────────────────────────────────────────────────────────

export interface PayoutProof {
  readonly proofId: string
  readonly payoutId: string
  readonly orgId: string
  readonly recipientId: string
  readonly recipientName: string
  readonly amountMinor: number
  readonly currency: string
  readonly revenueSourceBreakdown: readonly RevenueSourceAmount[]
  readonly royaltyComputationHashes: readonly string[]
  readonly provider: string
  readonly providerRef: string | null
  readonly status: 'generated' | 'disbursed' | 'confirmed' | 'failed'
  readonly proofHash: string
  readonly generatedAt: string
  readonly disbursedAt: string | null
}

export interface RevenueSourceAmount {
  readonly source: string
  readonly amountMinor: number
  readonly units: number
}

export interface PayoutProofInput {
  readonly payoutId: string
  readonly orgId: string
  readonly recipientId: string
  readonly recipientName: string
  readonly amountMinor: number
  readonly currency: string
  readonly revenueSourceBreakdown: readonly RevenueSourceAmount[]
  readonly royaltyComputationHashes: readonly string[]
  readonly provider: string
  readonly providerRef?: string
}

// ── Hash ──────────────────────────────────────────────────────────────────

function hashProof(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return `proof-${Math.abs(hash).toString(16).padStart(8, '0')}`
}

// ── Proof Generation ──────────────────────────────────────────────────────

/**
 * Generate a payout proof with a deterministic hash.
 * The proof links back to the royalty computations that justified this payout.
 */
export function generatePayoutProof(input: PayoutProofInput): PayoutProof {
  if (input.amountMinor <= 0) {
    throw new Error('Payout amount must be positive')
  }

  // Verify that revenue breakdown sums to total
  const breakdownTotal = input.revenueSourceBreakdown.reduce((s, r) => s + r.amountMinor, 0)
  if (breakdownTotal !== input.amountMinor) {
    throw new Error(
      `Revenue breakdown total (${breakdownTotal}) does not match payout amount (${input.amountMinor})`,
    )
  }

  const generatedAt = new Date().toISOString()
  const proofId = `pp-${input.payoutId}-${Date.now()}`

  const hashInput = JSON.stringify({
    payoutId: input.payoutId,
    orgId: input.orgId,
    recipientId: input.recipientId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    revenueSourceBreakdown: input.revenueSourceBreakdown,
    royaltyComputationHashes: input.royaltyComputationHashes,
    generatedAt,
  })

  return {
    proofId,
    payoutId: input.payoutId,
    orgId: input.orgId,
    recipientId: input.recipientId,
    recipientName: input.recipientName,
    amountMinor: input.amountMinor,
    currency: input.currency,
    revenueSourceBreakdown: input.revenueSourceBreakdown,
    royaltyComputationHashes: input.royaltyComputationHashes,
    provider: input.provider,
    providerRef: input.providerRef ?? null,
    status: 'generated',
    proofHash: hashProof(hashInput),
    generatedAt,
    disbursedAt: null,
  }
}

/**
 * Mark a proof as disbursed after successful payout execution.
 */
export function markProofDisbursed(proof: PayoutProof, providerRef: string): PayoutProof {
  return {
    ...proof,
    status: 'disbursed',
    providerRef,
    disbursedAt: new Date().toISOString(),
  }
}

/**
 * Verify the integrity of a proof by recomputing its hash.
 */
export function verifyProofIntegrity(proof: PayoutProof): boolean {
  const hashInput = JSON.stringify({
    payoutId: proof.payoutId,
    orgId: proof.orgId,
    recipientId: proof.recipientId,
    amountMinor: proof.amountMinor,
    currency: proof.currency,
    revenueSourceBreakdown: proof.revenueSourceBreakdown,
    royaltyComputationHashes: proof.royaltyComputationHashes,
    generatedAt: proof.generatedAt,
  })
  return proof.proofHash === hashProof(hashInput)
}
