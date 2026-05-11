/**
 * @nzila/continuity-observability — Posture helpers
 *
 * Aggregation-stance helpers. All inputs are system-scoped. Any payload key
 * that resolves an individual is structurally rejected.
 *
 * @module @nzila/continuity-observability/posture
 */
import { z } from 'zod'

import type {
  ContinuityIndicator,
  ContinuityPosture,
  ContinuityScope,
  ContinuityTrajectory,
} from './types'

const continuityScopeSchema: z.ZodType<ContinuityScope> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('product'), product: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('surface'), surfaceId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('route'), routeId: z.string().min(1) }).strict(),
  z.object({ kind: z.literal('pilot'), pilotScope: z.string().min(1) }).strict(),
])

export const continuityIndicatorSchema: z.ZodType<ContinuityIndicator> = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    scope: continuityScopeSchema,
    posture: z.enum(['stable', 'warming', 'concerning', 'destabilizing']),
    trajectory: z.enum(['improving', 'stable', 'drifting']),
    observedAt: z.string().refine((s) => !Number.isNaN(Date.parse(s))),
  })
  .strict()

const POSTURE_RANK: Record<ContinuityPosture, number> = {
  stable: 0,
  warming: 1,
  concerning: 2,
  destabilizing: 3,
}

/**
 * Return the worst posture across a set of indicators. Refuses to collapse
 * a single composite score; instead, returns the dominant posture verbatim.
 */
export function dominantPosture(
  indicators: readonly ContinuityIndicator[],
): ContinuityPosture {
  if (indicators.length === 0) return 'stable'
  return indicators.reduce<ContinuityPosture>((worst, ind) => {
    return POSTURE_RANK[ind.posture] > POSTURE_RANK[worst] ? ind.posture : worst
  }, 'stable')
}

/**
 * Return the dominant trajectory using a worst-case ordering:
 *   improving < stable < drifting
 */
export function dominantTrajectory(
  indicators: readonly ContinuityIndicator[],
): ContinuityTrajectory {
  if (indicators.length === 0) return 'stable'
  const order: Record<ContinuityTrajectory, number> = {
    improving: 0,
    stable: 1,
    drifting: 2,
  }
  return indicators.reduce<ContinuityTrajectory>((worst, ind) => {
    return order[ind.trajectory] > order[worst] ? ind.trajectory : worst
  }, 'improving')
}
