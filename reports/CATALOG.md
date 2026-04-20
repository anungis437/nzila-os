# Reports Catalog

Classification of all files in `reports/`. Generated reports are rebuilt by scripts;
commercial reports are buyer/investor-facing; operational reports track live state.

## Generated (rebuilt by scripts)

| File | Generator |
| --- | --- |
| architecture-audit.json | `pnpm validate:architecture` |
| claim-verification.json / .md | `pnpm validate:claims` |
| coverage/dashboard.json / .md | `pnpm coverage:dashboard` |
| doc-consistency.json / .md | `pnpm validate:docs` |
| documentation-index.json | `pnpm docs:index` |
| finops-executive-dashboard.json | `pnpm finops:build` |
| finops-ledger.jsonl | `pnpm finops:build` |
| finops-summary.json | `pnpm finops:build` |
| ops-readiness-audit.json / .md | `pnpm repo:audit` |
| ownership-registry.json | `pnpm ownership:audit` |
| package-audit.json | `pnpm validate:packages` |
| portfolio-forecast.json | `pnpm generate:portfolio-artifacts` |
| portfolio-ops-dashboard.json | `pnpm generate:portfolio-artifacts` |
| portfolio-pnl.json | `pnpm generate:portfolio-artifacts` |
| portfolio-status.json / .md | `pnpm generate:portfolio-artifacts` |
| readme-audit.json | `pnpm validate:readmes` |
| release-gate.json | `pnpm release:audit` |
| release-governance-audit.json | `pnpm release:audit` |
| release-secret-audit.json | `pnpm release:secrets:audit` |
| repo-excellence-audit.json / .md | `pnpm repo:audit` |
| sre-alert-routing-dry-run.json | `pnpm sre:alerts:dry-run` |
| sre-executive-dashboard.json | `pnpm sre:dashboard` |
| sre-reliability-audit.json | `pnpm sre:audit` |
| sre-synthetic-dry-run.json | `pnpm sre:synthetic:dry-run` |
| staging-recovery-dashboard.json | `pnpm sre:staging:recovery` |
| strategy/quarterly-scorecard.json / .md | `pnpm strategic:quarterly` |
| validation-severity-summary.md | `pnpm validate:all` |

## Commercial (buyer/investor-facing)

| File | Audience |
| --- | --- |
| board-pack.md | Board / investors |
| buyer-safe-platform-summary.md | Buyer diligence |
| capital-allocation.md | Investors |
| capital-alerts.md | CFO / investors |
| capital-overrides.md | CFO |
| capital-scenarios.md | CFO / investors |
| capital-signal-readiness.md | Investors |
| cash-calendar.md | CFO |
| commercial-alerts.md | Sales leadership |
| commercial-board-pack.md | Board / investors |
| founder-commercial-roi.md | Investors |
| market-pull.md | Investors |
| pilot-conversion.md | Sales |
| pilot-profitability.json | CFO |
| portfolio-investor-view.md | Investors |
| pricing-opportunities.md | Sales / CFO |
| resource-allocation.md | Investors |
| retention-risk.md | Investors |
| revenue-forecast.md | CFO / investors |
| runway-scenarios.md | CFO / investors |
| top-3-to-fund.md | Investors |
| unit-economics.csv | CFO / investors |

## Operational (live product reports)

| File | Domain |
| --- | --- |
| app-margin-scorecard.md | Product economics |
| founder-time-map.md | Resource allocation |
| governance-enforcement.md | Governance |
| integration-contract-status.md | Integrations |
| kill-list.md | Product decisions |
| product-shutdown-playbooks.md | Product lifecycle |
| test-coverage-portfolio.md | Quality |

## Product-Specific

| File | Product |
| --- | --- |
| console-*.md (10 files) | Console |
| ue-*.md (14 files) | Union Eyes |
| zonga-*.md / .json (12 files) | Zonga |

## Canonical (single source of truth)

| File | Purpose |
| --- | --- |
| final-repo-scorecard.md | Current repo maturity score |
| final-10-blocker-audit.md | Top blockers |
| final-focus-matrix.md | Priority matrix |
| HARDENING_SUMMARY.md | Security hardening status |

## Archive

| Path | Contents |
| --- | --- |
| archive/audit-report*.json | Historical audit snapshots |
| archive/legacy-scorecards/ | Superseded maturity scores |
