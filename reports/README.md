# Reports

> Generated audit reports, scorecards, and analysis artifacts produced by scripts and tooling.

All files in this directory are **generated outputs** — not hand-authored documentation.
Regenerate them by running the corresponding scripts in `scripts/` or `tooling/`.

## Audit Reports

| Report | Format | Source |
|--------|--------|--------|
| `architecture-audit.json` | JSON | `tooling/validation/architecture-audit.ts` |
| `claim-verification.json` / `.md` | JSON + MD | `tooling/validation/claim-verification.ts` |
| `doc-consistency.json` | JSON | `tooling/validation/doc-consistency.ts` |
| `governance-enforcement.md` | MD | `scripts/governance-check.ts` |
| `HARDENING_SUMMARY.md` | MD | Hardening pass summary |
| `ops-readiness-audit.json` / `.md` | JSON + MD | `tooling/ops/validate-ops-pack.ts` |
| `package-audit.json` | JSON | `tooling/validation/package-audit.ts` |
| `readme-audit.json` | JSON | `scripts/validate-readmes.ts` |
| `release-gate.json` | JSON | `scripts/validate-release-strict.ts` |
| `unsafe-claims.md` | MD | Claim verification output |
| `AUTOMATION_VALIDATION_REPORT.md` | MD | Automation validation |

## Scorecards & Certification

| Report | Format | Purpose |
|--------|--------|---------|
| `scorecard.json` / `.md` | JSON + MD | Platform scorecard |
| `platform-grade-adjusted.md` | MD | Adjusted platform grade |
| `platform-scorecard-adjusted.md` | MD | Adjusted scorecard |
| `portfolio-maturity.json` / `.md` | JSON + MD | Portfolio maturity assessment |

## Analysis

| Report | Purpose |
|--------|---------|
| `UE_REALIGNMENT_OUTPUT.md` | Union Eyes realignment output |
| `UE_WORKFLOW_REALIGNMENT_DISCOVERY_AUDIT.md` | Union Eyes workflow discovery |
| `validation-severity-summary.md` | Validation severity summary |
| `integration-contract-status.md` | Integration contract status |
| `test-coverage-portfolio.md` | Test coverage portfolio |
| `buyer-safe-platform-summary.md` | Buyer-safe platform summary |
