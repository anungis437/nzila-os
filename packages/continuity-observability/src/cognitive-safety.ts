/**
 * @nzila/continuity-observability — Cognitive safety
 *
 * SYSTEM-centered cognitive safety thresholds. Refuses individual-resolving
 * inputs at the schema boundary.
 *
 * @module @nzila/continuity-observability/cognitive-safety
 */
import { z } from 'zod'

import type {
  CognitiveSafetyThreshold,
  StabilizationRecommendation,
} from './types'

export const cognitiveSafetyThresholdSchema: z.ZodType<CognitiveSafetyThreshold> = z
  .object({
    dimension: z.enum([
      'density',
      'refresh-cadence',
      'notification-rate',
      'escalation-concentration',
    ]),
    surfaceId: z.string().min(1),
    threshold: z.number().nonnegative(),
    currentValue: z.number().nonnegative(),
    calmWindowSeconds: z.number().int().nonnegative(),
    observedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()

export function isOverBudget(threshold: CognitiveSafetyThreshold): boolean {
  return threshold.currentValue > threshold.threshold
}

export function recommendStabilization(
  threshold: CognitiveSafetyThreshold,
  options: { readonly issuedAt?: string } = {},
): StabilizationRecommendation | null {
  if (!isOverBudget(threshold)) return null

  const kindByDimension = {
    density: 'reduce-density',
    'refresh-cadence': 'extend-refresh-cadence',
    'notification-rate': 'reduce-notifications',
    'escalation-concentration': 'distribute-escalation',
  } as const

  return {
    id: `stab.${threshold.surfaceId}.${threshold.dimension}.${threshold.observedAt}`,
    kind: kindByDimension[threshold.dimension],
    scope: { kind: 'surface', surfaceId: threshold.surfaceId },
    rationale: `${threshold.dimension} value ${threshold.currentValue} exceeds threshold ${threshold.threshold}`,
    doctrineCitations: [
      {
        document: 'docs/nzila-governance/executive-cognitive-governance-standards.md',
      },
    ],
    issuedAt: options.issuedAt ?? new Date().toISOString(),
  }
}
