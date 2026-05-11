/**
 * @nzila/assurance-engine — Bands
 *
 * Banding rules. Bands are derived from compliance rate, observation
 * volume, and signal completeness. Composite collapse is refused.
 *
 * @module @nzila/assurance-engine/bands
 */
import { z } from 'zod'

import type {
  AssuranceBand,
  AssuranceConfidence,
  AssuranceDimensionInput,
  AssuranceScope,
} from './types'

const assuranceScopeSchema: z.ZodType<AssuranceScope> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('platform') }).strict(),
  z.object({ kind: z.literal('product'), product: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('environment'), environment: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('pilot'), pilotScope: z.string().min(1) }).strict(),
])

export const assuranceDimensionInputSchema: z.ZodType<AssuranceDimensionInput> = z
  .object({
    dimension: z.enum([
      'governance-legitimacy',
      'continuity-resilience',
      'deployment-legitimacy',
      'executive-cognitive-safety',
      'operational-calmness',
      'governance-safe-ai',
      'continuity-safe-modernization',
    ]),
    scope: assuranceScopeSchema,
    observed: z.number().int().nonnegative(),
    compliant: z.number().int().nonnegative(),
    signalCompleteness: z.number().min(0).max(1),
    evidence: z.array(
      z
        .object({
          id: z.string().min(1),
          contentHash: z.string().min(8),
          description: z.string().min(1),
        })
        .strict(),
    ),
    windowStart: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
    windowEnd: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()
  .refine((i) => i.compliant <= i.observed, {
    message: 'compliant cannot exceed observed',
    path: ['compliant'],
  })

/**
 * Band derivation. Thresholds are intentionally interpretive, not numeric
 * SLO targets. Banding is monotonic in compliance rate.
 */
export function deriveBand(input: AssuranceDimensionInput): AssuranceBand {
  if (input.observed === 0) return 'forming'
  const rate = input.compliant / input.observed
  if (rate >= 0.99) return 'strong'
  if (rate >= 0.95) return 'established'
  if (rate >= 0.85) return 'forming'
  return 'concern'
}

export function deriveConfidence(input: AssuranceDimensionInput): AssuranceConfidence {
  if (input.signalCompleteness >= 0.9 && input.observed >= 30) return 'high'
  if (input.signalCompleteness >= 0.7 && input.observed >= 10) return 'moderate'
  return 'low'
}
