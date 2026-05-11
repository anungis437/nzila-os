/**
 * @nzila/trustcore-contracts — Pure zod contracts shared across the
 * TrustCore family of packages and apps.
 *
 * Sub-modules:
 *   - trust-severity/  Shared TrustSeverity enum + ordering helpers.
 *   - mandates/        TrustOps mandate input/output zod schemas.
 *   - creditors/       Creditor classification + input zod schemas.
 *   - claims/          Proof-of-claim zod schemas.
 *   - fsm/             TrustOps FSM stage enum + transition contracts.
 *   - attestations/    Attestation envelope contracts (signed records).
 *
 * NOTE: This package MUST stay pure (only `zod`). No DB / OTel / Drizzle
 * imports. It is consumed by edge runtimes, server components, and tests.
 */

export * from './trust-severity/index'
export * from './mandates/index'
export * from './creditors/index'
export * from './claims/index'
export * from './fsm/index'
export * from './attestations/index'
