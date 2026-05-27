# Command Catalog

## Purpose

This catalog reduces script fatigue by grouping high-value commands into predictable operator workflows.

All commands are explicit (no root alias forwarding).

## Fast Paths

| Goal | Command |
|---|---|
| Validate typical PR quality quickly | See [Core Engineering](#core-engineering) |
| Run full governance gate stack | See [Governance and Compliance](#governance-and-compliance) |
| Generate governance-ready artifacts | See [Release and Risk Control](#release-and-risk-control) |
| Generate strategic quarterly telemetry report | `node tooling/scripts/generate-quarterly-strategic-scorecard.mjs` |
| Print grouped command help in terminal | `node tooling/scripts/show-command-catalog.mjs` |

## Grouped Workflows

### Core Engineering

```bash
pnpm lint
pnpm typecheck
pnpm test:changed
pnpm lint && pnpm typecheck && pnpm test:changed
```

### Governance and Compliance

```bash
pnpm exec tsx tooling/ga-check/ga-check.ts && \
pnpm contract-tests && \
pnpm inventory:check && \
pnpm exec tsx scripts/check-brand-leakage.ts && \
pnpm exec tsx scripts/validate-product-catalog.ts && \
pnpm exec tsx scripts/validate-portfolio.ts && \
pnpm exec tsx scripts/validate-canonical-truth.ts && \
pnpm exec tsx scripts/validate-truth-authority.ts && \
pnpm exec tsx scripts/validate-auth-authority.ts && \
pnpm exec tsx scripts/validate-ga-state.ts && \
pnpm exec tsx scripts/validate-workspace-links.ts && \
pnpm exec tsx scripts/validate-release-strict.ts && \
pnpm exec tsx scripts/generate-commercial-traction.ts && \
pnpm exec tsx tooling/governance/validate-governance-gate.ts && \
pnpm exec tsx scripts/validate-evidence-lifecycle-policy.ts && \
node tooling/scripts/validate-strategic-resilience.mjs --enforce && \
node tooling/scripts/check-governance-runtime-budget.mjs --enforce
```

### Release and Risk Control

```bash
pnpm lint && \
pnpm typecheck && \
pnpm test:changed && \
pnpm exec tsx tooling/ga-check/ga-check.ts && \
pnpm contract-tests && \
pnpm inventory:check && \
pnpm exec tsx scripts/check-brand-leakage.ts && \
pnpm exec tsx scripts/validate-product-catalog.ts && \
pnpm exec tsx scripts/validate-portfolio.ts && \
pnpm exec tsx scripts/validate-canonical-truth.ts && \
pnpm exec tsx scripts/validate-truth-authority.ts && \
pnpm exec tsx scripts/validate-auth-authority.ts && \
pnpm exec tsx scripts/validate-ga-state.ts && \
pnpm exec tsx scripts/validate-workspace-links.ts && \
pnpm exec tsx scripts/validate-release-strict.ts && \
pnpm exec tsx scripts/generate-commercial-traction.ts && \
pnpm exec tsx tooling/governance/validate-governance-gate.ts && \
pnpm exec tsx scripts/validate-evidence-lifecycle-policy.ts && \
node tooling/scripts/validate-strategic-resilience.mjs --enforce && \
node tooling/scripts/check-governance-runtime-budget.mjs --enforce && \
pnpm exec tsx scripts/financial-service-health.ts && \
pnpm exec tsx tooling/security-headers-check.ts && \
node tooling/scripts/generate-coverage-dashboard.mjs && \
node tooling/scripts/generate-quarterly-strategic-scorecard.mjs && \
node tooling/scripts/collect-dora-metrics.mjs && \
node tooling/scripts/collect-cost-attribution.mjs && \
node tooling/scripts/collect-onboarding-kpis.mjs
```

## Notes

- This file is documentation only; script definitions remain in `package.json`.
- Add new scripts to one of the groups above to keep discoverability high.
