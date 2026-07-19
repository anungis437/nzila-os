# Full Ecosystem Convergence Finalization

Authority: `master-finalization-index.md`. As of 2026-07-03.

Convergence is asserted only across the **declared production surface**
(`union-eyes`, `web`, `partners`) plus the governed platform, not the full 26-app
repository (incubating/internal/retired apps are explicitly out of production scope
per `docs/readiness/production-surface-inventory.md`).

## Convergence axes (all STRONG — see `proof-artifacts/finalization/convergence-audit.json`)

1. Production-surface classification — frozen, 0 UNKNOWN (`validate:production-surface`).
2. Deploy authority — OIDC-only, no forbidden-class prod deploy (`validate:production-deploy-authority`).
3. Org-context substrate — BR-6 closed, fail-closed resolver (`validate:br6-org-context`).
4. Runtime isolation — dedicated `nzila-canada-prod-env` (az verified).
5. Artifact identity — all three prod apps digest-pinned.
6. Data/backup posture — 30d retention, geo-redundant, ZR-HA + restore drill.
7. DNS/TLS/ingress — three prod domains live with valid managed TLS.
8. Gate-authority taxonomy — 39 gates, honest advisory/blocking split.

Each axis maps to a live `az` read or a passing gate; none is narrative-only.
