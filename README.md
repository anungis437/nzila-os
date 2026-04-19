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

## Proof and Trust Surfaces

- Proof center: [docs/proof-center/portfolio-proof-index.md](docs/proof-center/portfolio-proof-index.md)
- Buyer packs: [docs/buyers/union-eyes-buyer-pack.md](docs/buyers/union-eyes-buyer-pack.md), [docs/buyers/flow-buyer-pack.md](docs/buyers/flow-buyer-pack.md)
- Investor one-pager: [docs/investor/final-investor-onepager.md](docs/investor/final-investor-onepager.md)

## Governance and Validation

- Portfolio artifact generation: `pnpm generate:portfolio-artifacts`
- Portfolio governance validation: `pnpm validate:portfolio-governance`
- Full governance gate: `pnpm validate:governance`

## Additional References

- Platform overview: [docs/platform/what-is-nzila.md](docs/platform/what-is-nzila.md)
- Portfolio matrix: [docs/platform/portfolio-matrix.md](docs/platform/portfolio-matrix.md)
- Documentation index: [docs/README.md](docs/README.md)
- Canonical repo inventory: [tooling/repo-inventory/output/repo-inventory.md](tooling/repo-inventory/output/repo-inventory.md)
