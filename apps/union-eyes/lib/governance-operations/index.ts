/**
 * Governance operations bindings for UnionEyes (UE Ops surface).
 *
 * Re-exports the governance operations primitives consumed by UE Ops
 * pilot posture, pilot attestations, pilot deployment verdicts, and
 * pilot review workflow entries.
 *
 * IMPORTANT: do NOT import this module from edge runtime files (e.g.
 * apps/union-eyes/proxy.ts). The downstream packages depend on `zod`
 * which is fine for edge, but historical regressions have shown that
 * any expansion of governance imports in edge middleware risks the
 * `node:crypto` boundary. Keep edge middleware governance-free.
 *
 * See docs/nzila-governance-operations/live-governance-review-panels.md
 */
export * from '@nzila/governance-operations'
export * as continuityReview from '@nzila/continuity-review'
export * as attestationVisibility from '@nzila/attestation-visibility'
export * as governanceReview from '@nzila/governance-review'
export * as stabilizationSignals from '@nzila/stabilization-signals'
