/**
 * @nzila/assurance-engine — Calculator
 *
 * Per-dimension banding. Composite collapse is refused.
 *
 * @module @nzila/assurance-engine/calculator
 */
import {
  assuranceDimensionInputSchema,
  deriveBand,
  deriveConfidence,
} from './bands'
import type {
  AssuranceCalculator,
  AssuranceDimensionInput,
  AssurancePostureRead,
} from './types'

export class CompositeCollapseRefusedError extends Error {
  constructor() {
    super(
      'composite_collapse_refused: assurance must be presented per-dimension; no single overall score is emitted',
    )
    this.name = 'CompositeCollapseRefusedError'
  }
}

export class StandardAssuranceCalculator implements AssuranceCalculator {
  band(
    input: AssuranceDimensionInput,
    options: { readonly evaluatedAt?: string } = {},
  ): AssurancePostureRead {
    const validated = assuranceDimensionInputSchema.parse(input)
    const band = deriveBand(validated)
    const confidence = deriveConfidence(validated)
    const rate = validated.observed === 0 ? 0 : validated.compliant / validated.observed
    return {
      dimension: validated.dimension,
      scope: validated.scope,
      band,
      confidence,
      rationale: `compliance rate ${(rate * 100).toFixed(1)}% over ${validated.observed} observation(s); signal completeness ${(validated.signalCompleteness * 100).toFixed(0)}%`,
      evidence: validated.evidence,
      evaluatedAt: options.evaluatedAt ?? new Date().toISOString(),
      windowStart: validated.windowStart,
      windowEnd: validated.windowEnd,
    }
  }
}

/**
 * Refusal helper. Any consumer attempting to collapse multiple dimensions
 * into a single composite score MUST go through this function so the
 * refusal is explicit and citable.
 */
export function refuseCompositeCollapse(): never {
  throw new CompositeCollapseRefusedError()
}
