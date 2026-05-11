/**
 * @nzila/stabilization-signals
 *
 * Pure primitives for governance stabilization indicators. Each
 * function returns a banded reading; none returns a numeric score.
 */
import { z } from 'zod'

export const STABILIZATION_BANDS = [
  'stable',
  'warming',
  'concerning',
  'destabilizing',
] as const
export type StabilizationBand = (typeof STABILIZATION_BANDS)[number]

export const STABILIZATION_SIGNALS = [
  'operational-calmness',
  'governance-stability',
  'continuity-stabilization',
  'modernization-pacing',
  'deployment-confidence',
  'onboarding-continuity',
  'rollout-posture',
] as const
export type StabilizationSignalKind = (typeof STABILIZATION_SIGNALS)[number]

export const stabilizationReadingSchema = z
  .object({
    signal: z.enum(STABILIZATION_SIGNALS),
    banding: z.enum(STABILIZATION_BANDS),
    observedAt: z.string().datetime(),
    windowMinutes: z.number().int().positive(),
    /** Always system-scoped. */
    scope: z.object({ kind: z.literal('system'), systemId: z.string().min(1) }),
    interpretation: z.string().min(1).max(280),
    advisory: z.string().min(1).max(280),
  })
  .strict()

export type StabilizationReading = z.infer<typeof stabilizationReadingSchema>

/**
 * Map an aggregate observation count to a band. Inputs MUST already
 * be aggregated by the caller; this helper does not perform person
 * resolution and does not store individual observations.
 */
export function bandFromObservation(input: {
  readonly disturbanceCount: number
  readonly windowMinutes: number
}): StabilizationBand {
  const ratePerHour = (input.disturbanceCount / Math.max(input.windowMinutes, 1)) * 60
  if (ratePerHour < 1) return 'stable'
  if (ratePerHour < 4) return 'warming'
  if (ratePerHour < 12) return 'concerning'
  return 'destabilizing'
}

/**
 * Stabilization advisory. Language is stabilization-oriented; never
 * accelerationist; never escalates on repeat.
 */
export function stabilizationAdvisory(band: StabilizationBand): string {
  switch (band) {
    case 'stable':
      return 'Maintain current cadence. No change recommended.'
    case 'warming':
      return 'Extend cadence by one cycle and review with the continuity reviewer on the next slow refresh.'
    case 'concerning':
      return 'Reduce rollout density and distribute load across the next two cycles.'
    case 'destabilizing':
      return 'Pause non-essential changes and convene a stabilization review session.'
  }
}

/**
 * Build a stabilization reading. Refresh cadence is enforced to be
 * at least five minutes; faster cadences are rejected.
 */
export function buildStabilizationReading(
  input: Omit<StabilizationReading, 'advisory'> & { readonly advisory?: string },
): StabilizationReading {
  if (input.windowMinutes < 5) {
    throw new Error('stabilization_window_must_be_at_least_5_minutes')
  }
  return stabilizationReadingSchema.parse({
    ...input,
    advisory: input.advisory ?? stabilizationAdvisory(input.banding),
  })
}

/**
 * Refusal: composite scoring is never produced. Callers asking for a
 * composite must accept a banded reading per signal instead.
 */
export function composite(): never {
  throw new Error('stabilization_signals_refuse_composite_scoring')
}

export const STABILIZATION_REFRESH_MS = 5 * 60_000
