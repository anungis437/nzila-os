# Nzila OS

Nzila is a governed multi-product software group. This repository is the canonical operating and truth system.

All apps use `@nzila/platform-auth` as the canonical authentication layer.

## Products at a Glance

| Tier | Apps |
|---|---|
| **PRODUCTION** | union-eyes, flow, console, web |
| **PILOT** | control-plane, partners, cfo |
| **INCUBATING** | zonga, agrimo, trade, cora, nacp-exams, mobility |
| **EXPERIMENTAL** | mobility-client-portal, abr, platform-admin, orchestrator-api |

## Status authority model

- Product tier authority: [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts)
- Deployment/readiness authority: [nzila-truth-manifest.json](nzila-truth-manifest.json)
- Canonical product evidence authority: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json)

## Commercial Focus (Canonical)

### SELL NOW
- Union Eyes
- Flow

### USE INTERNALLY
- Console
- Control Plane
- Shared platform packages

### INCUBATE
- CFO
- Partners
- Zonga
- Agrimo
- Trade
- Cora
- NACP Exams
- Mobility
- ABR

### ARCHIVE / CUT PRIORITY
- Mobility Client Portal
- Platform Admin
- Orchestrator API

Source of truth: [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json)

## Proof and Trust Surfaces

- Proof center: [docs/proof-center/portfolio-proof-index.md](docs/proof-center/portfolio-proof-index.md)
- Buyer packs: [docs/buyers/union-eyes-buyer-pack.md](docs/buyers/union-eyes-buyer-pack.md), [docs/buyers/flow-buyer-pack.md](docs/buyers/flow-buyer-pack.md)
- Investor one-pager: [docs/investor/final-investor-onepager.md](docs/investor/final-investor-onepager.md)

## Governance and Validation

- Product catalog validation: `pnpm validate:product-catalog`
- Canonical truth anti-drift: `pnpm validate:canonical-truth`
- Full governance gate: `pnpm validate:governance`

## Additional References

- Platform overview: [docs/platform/what-is-nzila.md](docs/platform/what-is-nzila.md)
- Portfolio matrix: [docs/platform/portfolio-matrix.md](docs/platform/portfolio-matrix.md)
- Documentation index: [docs/README.md](docs/README.md)
- Canonical repo inventory: [tooling/repo-inventory/output/repo-inventory.md](tooling/repo-inventory/output/repo-inventory.md)
