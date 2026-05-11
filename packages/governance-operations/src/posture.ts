/**
 * @nzila/governance-operations — Posture primitives
 *
 * Banded, system-scoped posture readings that drive every governance
 * operations surface. Shapes are intentionally narrow: each card holds
 * exactly one truth.
 *
 * @module @nzila/governance-operations/posture
 */
import { z } from 'zod'

export const POSTURE_BANDS = ['stable', 'warming', 'concerning', 'destabilizing'] as const
export type PostureBand = (typeof POSTURE_BANDS)[number]

export const POSTURE_TRAJECTORIES = ['holding', 'stabilizing', 'drifting'] as const
export type PostureTrajectory = (typeof POSTURE_TRAJECTORIES)[number]

export const VERDICTS = ['verified', 'partial', 'rejected', 'unknown'] as const
export type Verdict = (typeof VERDICTS)[number]

export const postureCardSchema = z.object({
  id: z.string().min(1),
  surface: z.string().min(1),
  product: z.string().min(1),
  banding: z.enum(POSTURE_BANDS),
  trajectory: z.enum(POSTURE_TRAJECTORIES).optional(),
  /** One-sentence institutional interpretation. */
  interpretation: z.string().min(1).max(280),
  doctrineCitations: z
    .array(
      z.object({
        document: z.string().min(1),
        section: z.string().optional(),
      }),
    )
    .min(1),
  observedAt: z.string().datetime(),
  /** Optional banded sub-readings; never composite scores. */
  subBandings: z
    .array(
      z.object({
        label: z.string().min(1),
        banding: z.enum(POSTURE_BANDS),
      }),
    )
    .optional(),
})

export type PostureCard = z.infer<typeof postureCardSchema>

/**
 * Construct a posture card with safe defaults. Refuses to construct a
 * card without a citation.
 */
export function buildPostureCard(input: PostureCard): PostureCard {
  return postureCardSchema.parse(input)
}

/**
 * Combine N posture readings into a single dominant banding for a
 * surface. Refuses to compute a numeric score. The dominant band is
 * the strictest (worst) band among inputs.
 */
export function dominantBanding(bands: readonly PostureBand[]): PostureBand {
  if (bands.length === 0) return 'stable'
  const order: Record<PostureBand, number> = {
    stable: 0,
    warming: 1,
    concerning: 2,
    destabilizing: 3,
  }
  return bands.reduce((acc, b) => (order[b] > order[acc] ? b : acc), 'stable' as PostureBand)
}
