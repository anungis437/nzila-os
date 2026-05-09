/**
 * Governance operations bindings for Control Plane.
 *
 * Re-exports the governance operations primitives so Control Plane
 * surfaces (posture cards, attestation viewers, deployment legitimacy
 * panels, governance timeline) consume a single, uniform contract.
 *
 * See docs/nzila-governance-operations/live-governance-review-panels.md
 */
export * from '@nzila/governance-operations'
export * as continuityReview from '@nzila/continuity-review'
export * as attestationVisibility from '@nzila/attestation-visibility'
export * as governanceReview from '@nzila/governance-review'
export * as stabilizationSignals from '@nzila/stabilization-signals'
