/**
 * @nzila/trustcore-trustops — Pure domain primitives for the TrustOps
 * (insolvency / restructuring) vertical.
 *
 * NO DB / NO AUTH / NO HTTP imports. Apps and the @nzila/db query layer
 * compose this package with their own persistence + auth.
 *
 * Sub-modules:
 *   - fsm/        Mandate-stage transition validation + edge tables.
 *   - creditors/  Classification ordering + priority helpers.
 *   - claims/     Proof-of-claim status helpers (pure).
 *   - progress/   computeMandateProgress() — completion ratio for dashboards.
 */

export * from './fsm/index'
export * from './creditors/index'
export * from './claims/index'
export * from './progress/index'
