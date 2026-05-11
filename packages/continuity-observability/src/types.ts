/**
 * @nzila/continuity-observability — Types
 * @module @nzila/continuity-observability/types
 */

export type ContinuityPosture =
  | 'stable'
  | 'warming'
  | 'concerning'
  | 'destabilizing'

export type ContinuityTrajectory = 'improving' | 'stable' | 'drifting'

export type ContinuityScope =
  | { readonly kind: 'product'; readonly product: string }
  | { readonly kind: 'surface'; readonly surfaceId: string }
  | { readonly kind: 'route'; readonly routeId: string }
  | { readonly kind: 'pilot'; readonly pilotScope: string }

export interface ContinuityIndicator {
  readonly id: string
  readonly description: string
  readonly scope: ContinuityScope
  readonly posture: ContinuityPosture
  readonly trajectory: ContinuityTrajectory
  /** ISO timestamp of the most recent observation refresh. */
  readonly observedAt: string
}

export type CognitiveSafetyDimension =
  | 'density'
  | 'refresh-cadence'
  | 'notification-rate'
  | 'escalation-concentration'

export interface CognitiveSafetyThreshold {
  readonly dimension: CognitiveSafetyDimension
  readonly surfaceId: string
  /** Threshold value above which the surface is over-budget. */
  readonly threshold: number
  /** Current observed value at the SYSTEM scope (no individual resolution). */
  readonly currentValue: number
  /** Calm window: minimum recovery interval before re-alerting. */
  readonly calmWindowSeconds: number
  readonly observedAt: string
}

export type StabilizationKind =
  | 'reduce-density'
  | 'extend-refresh-cadence'
  | 'reduce-notifications'
  | 'distribute-escalation'
  | 'restore-calm-window'

export interface StabilizationRecommendation {
  readonly id: string
  readonly kind: StabilizationKind
  readonly scope: ContinuityScope
  readonly rationale: string
  readonly doctrineCitations: readonly { readonly document: string; readonly section?: string }[]
  readonly issuedAt: string
}
