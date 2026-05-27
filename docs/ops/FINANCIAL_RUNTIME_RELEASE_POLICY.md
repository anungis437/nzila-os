# Financial Runtime Release Policy

<!--
  ARTIFACT TYPE: Release Policy
  CHANGE CLASS: Standard
  GOVERNANCE: docs/doctrine/DOCTRINE_GOVERNANCE.md
  STATUS: Active
  LAST_VALIDATED: 2026-05-22
-->

## Scope

Applies to Union Eyes financial runtime surfaces, including `apps/union-eyes/services/financial-service`.

## Hard Release Gates

A release is blocked when any required gate fails.

Required gates:

1. `pnpm --filter financial-service typecheck`
2. `pnpm --filter financial-service lint`
3. `pnpm --filter financial-service test`
4. `pnpm exec tsx scripts/financial-service-health.ts`
5. `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts`
6. `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts`
7. `pnpm test:fast`

## Fail-Closed Rules

1. Missing runtime boundary validation is a release blocker.
2. Crash-prone error handling is a release blocker.
3. Domain contract mismatches in payroll/remittance/compliance are release blockers.
4. Stripe webhook verification failures are release blockers.

## Evidence Requirements

Every release candidate must include:

- latest gate run evidence,
- financial-service test summary,
- unresolved risk list with explicit owner,
- GO/NO-GO decision record.

## Architectural Classification

Financial-service classification: Strategic.

Implication:

- full governance enforcement is mandatory,
- service failures block release readiness,
- no silent downgrade to advisory-only validation.

## Policy Review Cadence

- review on each release train,
- monthly governance review,
- immediate update after any Sev-1/Sev-2 runtime incident.
