/**
 * @nzila/trustcore-core/compliance — Law 25 compliance scoring SoT.
 *
 * Single source of truth for the Law 25 compliance evaluator and the
 * dashboard-summary derivation. All apps and packages MUST import from
 * here (or `@nzila/trustcore-core/compliance`) rather than re-implementing
 * scoring logic. See ADR: TrustCore Trust Ops v1 — Phase 1, Step D.
 */

export * from './types'
export * from './evaluators'
export * from './dashboard'
