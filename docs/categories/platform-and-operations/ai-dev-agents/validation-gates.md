# Nzila AI Dev Agent System - Validation Gates

This document defines blocking gates for AI-assisted changes in NzilaOS.

## Gate Philosophy

- No merge/release without all required gates passing.
- First failure stops pipeline.
- Gates are executed in deterministic order.
- No agent may bypass or suppress gate failures.

## Mandatory Gates (Blocking)

Run in this exact order:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:fast`
4. `pnpm exec tsx scripts/governance-check.ts`
5. `pnpm exec tsx scripts/check-decision-coverage.ts --strict`
6. `pnpm exec tsx scripts/ue-qa-gate.ts`

## Additional Blocking Validations

These are required for the AI-dev-agent full validation profile:

7. Pipeline health must be healthy:

- `pnpm intelligence:pipeline-health`

8. No integrity failures:

- `pnpm nar:chain:verify`

9. No alerting critical state:

- `pnpm exec tsx scripts/sre/alert-routing-dry-run.ts`

10. Cross-org isolation evidence check:

- `pnpm exec tsx packages/platform-validation/src/claim-verification.ts`

## Hard FAIL Conditions

Validation is `NO-GO` if any of the following is true:

- Any gate command exits non-zero.
- Any RBAC `UNKNOWN` remains in enforced RBAC reality mapping.
- Any mutation lacks required Decision/NAR expectation coverage.
- Any cross-org leakage indicator remains unresolved.
- Pipeline health is not healthy.
- Integrity verification fails.
- Critical alerting state is detected.

## Reproducible Execution

Recommended command:

- `pnpm exec tsx scripts/ai-agent-runner.ts --phase=validate`

Full deterministic pipeline:

- `pnpm exec tsx scripts/ai-agent-runner.ts --phase=full-run`

Both commands are orchestrated by `scripts/ai-agent-runner.ts` and write structured artifacts to `artifacts/ai-dev-agent/`.
