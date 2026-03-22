/**
 * @nzila/cfo-core — Financial Proof Engine
 *
 * Every financial output (report, forecast, advisory) MUST have an
 * accompanying FinancialProof that cryptographically attests to the
 * inputs, computation version, and outputs used to generate it.
 *
 * If a proof is missing or invalid, the output is rejected with
 * FINANCIAL_OUTPUT_BLOCKED_NO_PROOF.
 *
 * @module @nzila/cfo-core/proof
 */

import { createHash } from 'crypto'
import { z } from 'zod'

// ── Schema ──────────────────────────────────────────────────────────────────

export const FinancialProofSchema = z.object({
  reportId: z.string().min(1),
  orgId: z.string().min(1),
  inputSources: z.array(z.string()).min(1),
  calculationVersion: z.string().min(1),
  outputValues: z.record(z.string(), z.number()),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  generatedAt: z.string().datetime(),
})

export type FinancialProof = z.infer<typeof FinancialProofSchema>

// ── Errors ──────────────────────────────────────────────────────────────────

export class FinancialProofError extends Error {
  public readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'FinancialProofError'
    this.code = code
  }
}

// ── Hash computation ────────────────────────────────────────────────────────

/**
 * Compute a deterministic SHA-256 hash from input sources, calculation version,
 * and output values. The hash is stable for the same inputs regardless of
 * object key ordering.
 */
export function computeProofHash(params: {
  inputSources: string[]
  calculationVersion: string
  outputValues: Record<string, number>
}): string {
  const sortedOutputKeys = Object.keys(params.outputValues).sort()
  const outputParts = sortedOutputKeys.map(
    (k) => `${k}=${params.outputValues[k]}`,
  )

  const payload = [
    `inputs:${[...params.inputSources].sort().join(',')}`,
    `version:${params.calculationVersion}`,
    `outputs:${outputParts.join(',')}`,
  ].join('|')

  return createHash('sha256').update(payload).digest('hex')
}

// ── Proof lifecycle ─────────────────────────────────────────────────────────

/**
 * Generate a financial proof for a computation result.
 */
export function generateFinancialProof(params: {
  reportId: string
  orgId: string
  inputSources: string[]
  calculationVersion: string
  outputValues: Record<string, number>
}): FinancialProof {
  const hash = computeProofHash({
    inputSources: params.inputSources,
    calculationVersion: params.calculationVersion,
    outputValues: params.outputValues,
  })

  return {
    reportId: params.reportId,
    orgId: params.orgId,
    inputSources: params.inputSources,
    calculationVersion: params.calculationVersion,
    outputValues: params.outputValues,
    hash,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Verify a financial proof by recomputing the hash and comparing.
 * Returns true if the proof is valid.
 */
export function verifyFinancialProof(proof: FinancialProof): boolean {
  const expected = computeProofHash({
    inputSources: proof.inputSources,
    calculationVersion: proof.calculationVersion,
    outputValues: proof.outputValues,
  })
  return expected === proof.hash
}

/**
 * Assert that a financial output has a valid proof. Throws
 * FINANCIAL_OUTPUT_BLOCKED_NO_PROOF if proof is missing or invalid.
 */
export function requireFinancialProof(proof: FinancialProof | undefined | null): void {
  if (!proof) {
    throw new FinancialProofError(
      'FINANCIAL_OUTPUT_BLOCKED_NO_PROOF',
      'Financial output blocked: no proof attached. Every financial output must include a cryptographic proof.',
    )
  }

  const parseResult = FinancialProofSchema.safeParse(proof)
  if (!parseResult.success) {
    throw new FinancialProofError(
      'FINANCIAL_OUTPUT_BLOCKED_NO_PROOF',
      `Financial output blocked: proof schema invalid — ${parseResult.error.issues.map((i) => i.message).join(', ')}`,
    )
  }

  if (!verifyFinancialProof(proof)) {
    throw new FinancialProofError(
      'FINANCIAL_PROOF_HASH_MISMATCH',
      'Financial output blocked: proof hash does not match recomputed hash — data may have been tampered with.',
    )
  }
}
