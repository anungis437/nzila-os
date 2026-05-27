# Financial Service Release Checklist

## Blocking Gates

- [ ] `pnpm --filter financial-service typecheck`
- [ ] `pnpm --filter financial-service lint`
- [ ] `pnpm --filter financial-service test`
- [ ] `pnpm exec tsx scripts/financial-service-health.ts`
- [ ] `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts`
- [ ] `pnpm exec tsx packages/platform-validation/src/doc-consistency.ts && tsx scripts/build-ownership-registry.ts && pnpm exec tsx scripts/docs/build-docs-index.ts && pnpm exec tsx scripts/release/generate-governance-audit.ts && pnpm exec tsx scripts/release/audit-secrets.ts && pnpm exec tsx scripts/repo/build-excellence-audit.ts && pnpm exec tsx scripts/check-ue-db-import-guard.ts && pnpm exec tsx scripts/financial-service-health.ts`
- [ ] `pnpm test:fast`

## Runtime Safety

- [ ] Catch paths verified to avoid secondary crash behavior.
- [ ] Canonical logger path enforced across service modules.
- [ ] Runtime boundary validators active for donations/remittances/payroll/arrears.
- [ ] Stripe webhook verification and replay handling validated.

## Observability

- [ ] Failure taxonomy events present for webhook/remittance/payroll/reconciliation failures.
- [ ] Sensitive payload redaction verified.
- [ ] Correlation fields present in runtime error events.

## Decision

- [ ] GO decision signed by service owner and platform governance.
- [ ] NO-GO decision documented with blockers and remediation ETA when applicable.
