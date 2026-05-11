# Portfolio Proof Index

This index tracks all generated proof artifacts for the Nzila OS portfolio.

## Portfolio Artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Truth Manifest | `nzila-truth-manifest.json` | Single source of portfolio truth |
| Portfolio Status (JSON) | `reports/portfolio-status.json` | Machine-readable portfolio state |
| Portfolio Status (MD) | `reports/portfolio-status.md` | Human-readable portfolio summary |
| Portfolio Matrix | `docs/platform/portfolio-matrix.md` | Cross-app capability matrix |
| Portfolio Ops Dashboard | `reports/portfolio-ops-dashboard.json` | Operational dashboard data |
| Investor View | `reports/portfolio-investor-view.md` | Investor-facing summary |

## Proof Trail

Portfolio proof flows from `nzila-truth-manifest.json` → generated reports → this index.

All portfolio artifacts are regenerated via `pnpm generate:portfolio-artifacts`.
