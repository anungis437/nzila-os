/**
 * @nzila/assurance-engine — Types
 * @module @nzila/assurance-engine/types
 */

export type AssuranceBand = 'strong' | 'established' | 'forming' | 'concern'

export type AssuranceConfidence = 'high' | 'moderate' | 'low'

export type AssuranceDimension =
  | 'governance-legitimacy'
  | 'continuity-resilience'
  | 'deployment-legitimacy'
  | 'executive-cognitive-safety'
  | 'operational-calmness'
  | 'governance-safe-ai'
  | 'continuity-safe-modernization'

export type AssuranceScope =
  | { readonly kind: 'platform' }
  | { readonly kind: 'product'; readonly product: string }
  | { readonly kind: 'environment'; readonly environment: string }
  | { readonly kind: 'pilot'; readonly pilotScope: string }

export interface AssuranceEvidenceReference {
  readonly id: string
  readonly contentHash: string
  readonly description: string
}

export interface AssurancePostureRead {
  readonly dimension: AssuranceDimension
  readonly scope: AssuranceScope
  readonly band: AssuranceBand
  readonly confidence: AssuranceConfidence
  readonly rationale: string
  readonly evidence: readonly AssuranceEvidenceReference[]
  readonly evaluatedAt: string
  readonly windowStart: string
  readonly windowEnd: string
}

/**
 * Per-dimension input signal. Bands are derived from observed compliance
 * rates and signal completeness.
 */
export interface AssuranceDimensionInput {
  readonly dimension: AssuranceDimension
  readonly scope: AssuranceScope
  /** Total observed governance acts in the window. */
  readonly observed: number
  /** Acts judged compliant. */
  readonly compliant: number
  /** Confidence inputs. */
  readonly signalCompleteness: number // 0..1
  readonly evidence: readonly AssuranceEvidenceReference[]
  readonly windowStart: string
  readonly windowEnd: string
}

export interface AssuranceCalculator {
  band(input: AssuranceDimensionInput, options?: { evaluatedAt?: string }): AssurancePostureRead
}
