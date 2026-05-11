/**
 * @nzila/continuity-review
 *
 * Pure primitives for continuity posture review. Each dimension produces
 * a banded reading paired with a calm institutional sentence. Refuses
 * person-resolving content at the schema layer.
 */
import { z } from 'zod'

export const CONTINUITY_DIMENSIONS = [
  'fragmentation',
  'coordination-stabilization',
  'onboarding-continuity',
  'governance-friction',
  'escalation-concentration',
  'modernization-health',
] as const
export type ContinuityDimension = (typeof CONTINUITY_DIMENSIONS)[number]

export const CONTINUITY_BANDS = [
  'stable',
  'warming',
  'concerning',
  'destabilizing',
] as const
export type ContinuityBand = (typeof CONTINUITY_BANDS)[number]

export const CONTINUITY_TRAJECTORIES = ['holding', 'stabilizing', 'drifting'] as const
export type ContinuityTrajectory = (typeof CONTINUITY_TRAJECTORIES)[number]

const FORBIDDEN_PERSON_KEYS: ReadonlySet<string> = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'sessionId',
  'session_id',
])

export const continuityReviewCardSchema = z
  .object({
    dimension: z.enum(CONTINUITY_DIMENSIONS),
    banding: z.enum(CONTINUITY_BANDS),
    trajectory: z.enum(CONTINUITY_TRAJECTORIES),
    /** Always system-scoped. Person scoping is structurally absent. */
    scope: z.object({
      kind: z.literal('system'),
      systemId: z.string().min(1),
    }),
    interpretation: z.string().min(1).max(280),
    stabilizationGuidance: z.string().min(1).max(280),
    observedAt: z.string().datetime(),
    windowMinutes: z.number().int().positive(),
  })
  .strict()
  .superRefine((card, ctx) => {
    const text = `${card.interpretation} ${card.stabilizationGuidance}`
    for (const k of FORBIDDEN_PERSON_KEYS) {
      if (text.toLowerCase().includes(k.toLowerCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `forbidden_person_key_in_text: "${k}"`,
        })
      }
    }
  })

export type ContinuityReviewCard = z.infer<typeof continuityReviewCardSchema>

export function buildContinuityReviewCard(
  input: ContinuityReviewCard,
): ContinuityReviewCard {
  return continuityReviewCardSchema.parse(input)
}

/**
 * Generate the calm stabilization guidance for a given band. Language
 * is stabilization-oriented and never accelerationist.
 */
export function stabilizationGuidanceFor(band: ContinuityBand): string {
  switch (band) {
    case 'stable':
      return 'Maintain current cadence; no change recommended.'
    case 'warming':
      return 'Extend cadence by one cycle and review with the continuity reviewer.'
    case 'concerning':
      return 'Reduce rollout density and consult the governance forum before further changes.'
    case 'destabilizing':
      return 'Pause non-essential changes; convene a continuity review session.'
  }
}
