# Nzila OS

Nzila is a governed multi-product software group. This repository is the canonical operating and truth system.

All apps use `@nzila/platform-auth` as the canonical authentication layer.

## Portfolio Governance

Portfolio lifecycle truth has one editable authority: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json).

The score engine is also governed there through `scoring.weights`, so recommendation rankings are policy-controlled at the source.

Everything else is generated or validated from that catalog:

- Truth manifest: [nzila-truth-manifest.json](nzila-truth-manifest.json)
- Executive portfolio report: [reports/portfolio-status.md](reports/portfolio-status.md)
- Machine-readable portfolio status: [reports/portfolio-status.json](reports/portfolio-status.json)
- Investor view: [reports/portfolio-investor-view.md](reports/portfolio-investor-view.md)
- Ops dashboard feed: [reports/portfolio-ops-dashboard.json](reports/portfolio-ops-dashboard.json)
- Portfolio matrix: [docs/platform/portfolio-matrix.md](docs/platform/portfolio-matrix.md)

Safe update flow:

1. Edit [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json).
2. Run `pnpm generate:portfolio-artifacts`.
3. Run `pnpm validate:portfolio-governance`.

CI rejects drift if generated artifacts or downstream metadata fall out of sync with the catalog.

## Capital Discipline System

Nzila allocates capital, engineering hours, and founder attention from a single authority: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json).

Capital model governance rules:

- Product-level financial, resource, risk, and strategic fields are required for every product.
- Allocation weights are governed by `capital_weights` in the catalog (no hardcoded score weights).
- Scenario runway inputs are governed by `capital_model.scenarios` and explicitly marked as assumptions until live feeds are connected.

Run the engine:

1. Generate executive capital reports: `pnpm generate:capital-allocation`
2. Validate discipline gates: `pnpm validate:capital-discipline`
3. Compute runway scenarios: `pnpm runway:model`

Generated executive outputs:

- [reports/capital-allocation.md](reports/capital-allocation.md)
- [reports/resource-allocation.md](reports/resource-allocation.md)
- [reports/top-3-to-fund.md](reports/top-3-to-fund.md)
- [reports/kill-list.md](reports/kill-list.md)
- [reports/founder-time-map.md](reports/founder-time-map.md)
- [reports/runway-scenarios.md](reports/runway-scenarios.md)
- [reports/capital-signal-readiness.md](reports/capital-signal-readiness.md)

## Board-Grade Capital OS

The capital engine now operates as a board-grade capital operating system with four additional governance surfaces:

- Live signal ingestion via [governance/capital/manual-live-signals.csv](governance/capital/manual-live-signals.csv) and connector toggles for Stripe, HubSpot, QuickBooks, Gmail pipeline parsing, Supabase analytics, and GitHub engineering telemetry.
- Override governance via [governance/capital/override-log.json](governance/capital/override-log.json), so leadership deviations from model recommendations are tracked and reviewed over time.
- Cash calendar and scenario governance via [governance/capital/cash-calendar.json](governance/capital/cash-calendar.json) and [governance/capital/scenario-pack.json](governance/capital/scenario-pack.json).
- Confidence-aware scoring, board-pack automation, capital alerts, scenario stress tests, shutdown playbooks, and recommendation explainability.

Live signal operating notes:

- [governance/capital/manual-live-signals.csv](governance/capital/manual-live-signals.csv) is now pre-seeded with carry-forward catalog baselines so every product has an editable row. These seeded rows are explicitly marked `estimate` / `LOW`; they are not treated as verified actuals.
- Import-ready connector files live under [governance/capital/exports/stripe-export.csv](governance/capital/exports/stripe-export.csv), [governance/capital/exports/hubspot-export.csv](governance/capital/exports/hubspot-export.csv), [governance/capital/exports/quickbooks-export.csv](governance/capital/exports/quickbooks-export.csv), [governance/capital/exports/gmail-pipeline-export.csv](governance/capital/exports/gmail-pipeline-export.csv), and [governance/capital/exports/supabase-export.csv](governance/capital/exports/supabase-export.csv).
- Toggle and path wiring lives in [.env.capital.example](.env.capital.example). Do not enable a connector until a real export file exists.
- Leadership overrides can be appended without hand-editing JSON via `pnpm capital:override:add -- --product=zonga --engine=PAUSE --override="INCUBATE LIGHTLY" --reason="..." --owner=CEO`.

Additional commands:

1. Generate the 30/60/90 liquidity report: `pnpm cash:calendar`
2. Evaluate scenario stacks: `pnpm runway:model -- --scenario=union-eyes-major-pilot,flow-slips-90-days`
3. Rebuild the full board-grade capital pack: `pnpm generate:capital-allocation`

Additional outputs:

- [reports/cash-calendar.md](reports/cash-calendar.md)
- [reports/capital-alerts.md](reports/capital-alerts.md)
- [reports/capital-overrides.md](reports/capital-overrides.md)
- [reports/capital-scenarios.md](reports/capital-scenarios.md)
- [reports/product-shutdown-playbooks.md](reports/product-shutdown-playbooks.md)
- [reports/board-pack.md](reports/board-pack.md)

## Commercial Traction OS

Commercial traction now runs as a governed operating layer that separates evidence from assumptions for forecast, pipeline, pilot conversion, and retention risk.

Governed commercial sources:

- [governance/commercial/opportunities.json](governance/commercial/opportunities.json)
- [governance/commercial/pilots.json](governance/commercial/pilots.json)
- [governance/commercial/founder-activities.json](governance/commercial/founder-activities.json)
- [governance/commercial/retention-accounts.json](governance/commercial/retention-accounts.json)
- Connector templates in [governance/commercial/exports](governance/commercial/exports)
- Connector wiring in [.env.commercial.example](.env.commercial.example)

Run the engine:

1. Generate all commercial reports: `pnpm generate:commercial-traction`
2. Run contract coverage (includes traction specs): `pnpm contract-tests`

Generated outputs:

- [reports/revenue-forecast.md](reports/revenue-forecast.md)
- [reports/pilot-conversion.md](reports/pilot-conversion.md)
- [reports/founder-commercial-roi.md](reports/founder-commercial-roi.md)
- [reports/market-pull.md](reports/market-pull.md)
- [reports/retention-risk.md](reports/retention-risk.md)
- [reports/commercial-alerts.md](reports/commercial-alerts.md)
- [reports/commercial-board-pack.md](reports/commercial-board-pack.md)

## Proof and Trust Surfaces

- Proof center: [docs/proof-center/portfolio-proof-index.md](docs/proof-center/portfolio-proof-index.md)
- Monthly evidence packs: [proof-artifacts/evidence-packs](proof-artifacts/evidence-packs)
- Buyer packs: [docs/buyers/union-eyes-buyer-pack.md](docs/buyers/union-eyes-buyer-pack.md), [docs/buyers/flow-buyer-pack.md](docs/buyers/flow-buyer-pack.md), [docs/faircase/buyer-pack.md](docs/faircase/buyer-pack.md)
- Investor one-pager: [docs/investor/final-investor-onepager.md](docs/investor/final-investor-onepager.md)
- Ownership registry: [docs/ops/ownership-registry.md](docs/ops/ownership-registry.md)
- Documentation index: [docs/documentation-index.md](docs/documentation-index.md)

## Governance and Validation

- Portfolio artifact generation: `pnpm generate:portfolio-artifacts`
- Portfolio governance validation: `pnpm validate:portfolio-governance`
- Full governance gate: `pnpm validate:governance`
- Governance audit: `pnpm governance:audit`
- Release dry runs: `pnpm release:staging`, `pnpm release:prod`
- Reliability dry run: `pnpm sre:build`
- Monthly evidence pack: `pnpm evidence:pack:monthly`
- Repo excellence audit: `pnpm repo:audit`

## Additional References

- Platform overview: [docs/platform/what-is-nzila.md](docs/platform/what-is-nzila.md)
- Portfolio matrix: [docs/platform/portfolio-matrix.md](docs/platform/portfolio-matrix.md)
- Documentation index: [docs/README.md](docs/README.md)
- Canonical repo inventory: [tooling/repo-inventory/output/repo-inventory.md](tooling/repo-inventory/output/repo-inventory.md)
