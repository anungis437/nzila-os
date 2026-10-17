import { z } from 'zod'

export const continuityFidelityDimensions = [
  'semanticCompleteness',
  'provenanceCompleteness',
  'identityCompleteness',
  'relationshipCompleteness',
  'temporalCompleteness',
  'permissionCompleteness',
  'sourceFreshnessCompleteness',
  'rehydrationCompleteness',
] as const

export const continuityEvidenceStateSchema = z.enum([
  'ESTABLISHED',
  'PARTIAL',
  'UNRESOLVED',
  'NOT_PRESENT',
])

const continuityEvidenceSchema = z
  .object({
    dimension: z.enum(continuityFidelityDimensions),
    state: continuityEvidenceStateSchema,
    evidenceRefs: z.array(z.string().min(1)),
    reasons: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (evidence.state === 'ESTABLISHED' && evidence.evidenceRefs.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceRefs'],
        message: 'Established continuity fidelity requires explicit evidence references',
      })
    }
  })

export type ContinuityFidelityDimension = (typeof continuityFidelityDimensions)[number]
export type ContinuityEvidenceState = z.infer<typeof continuityEvidenceStateSchema>
export type ContinuityFidelityResult = {
  dimensions: z.infer<typeof continuityEvidenceSchema>[]
  state: 'COMPLETE' | 'PARTIAL' | 'UNRESOLVED'
  isPublicScore: false
  limitations: string[]
}

export function evaluateContinuityFidelity(
  evidence: z.input<typeof continuityEvidenceSchema>[],
): ContinuityFidelityResult {
  const byDimension = new Map(
    evidence.map((item) => [item.dimension, continuityEvidenceSchema.parse(item)]),
  )
  const dimensions = continuityFidelityDimensions.map(
    (dimension) =>
      byDimension.get(dimension) ?? {
        dimension,
        state: 'UNRESOLVED' as const,
        evidenceRefs: [],
        reasons: ['No explicit evidence supplied for this dimension'],
      },
  )
  const state = dimensions.every((item) => item.state === 'ESTABLISHED')
    ? 'COMPLETE'
    : dimensions.some((item) => item.state === 'UNRESOLVED')
      ? 'UNRESOLVED'
      : 'PARTIAL'

  return {
    dimensions,
    state,
    isPublicScore: false,
    limitations: [
      'Internal engineering and governance metric only; not a public score or vendor ranking',
      'Unknown evidence remains unresolved and never increases completeness',
    ],
  }
}
