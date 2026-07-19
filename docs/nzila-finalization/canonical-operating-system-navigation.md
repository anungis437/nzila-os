# Canonical Operating System Navigation

Authority: `master-finalization-index.md`. As of 2026-07-03.

The canonical navigation of the production surface and its governance.

## Production apps + domains (live)

- `union-eyes` → https://app.unioneyes.app (prod runtime `nzila-os-union-eyes-prod`).
- `web` → https://www.nzilaventures.com (prod runtime `nzila-os-web-prod`).
- `partners` → https://partners.nzilaventures.com (prod runtime `nzila-os-partners-prod`).

All three run in the dedicated `nzila-canada-prod-env` / `nzila-canada-prod-rg`.

## Internal-only (not publicly production-promotable)

- `console`, `control-plane` — restricted ingress; `prodPromotionEligible: false`.

## Governance navigation

- Surface authority: `governance/readiness/production-surface.json`.
- Deploy authority: `governance/release/{deployment-inventory,production-exceptions}.json` + `scripts/release/resolve-deploy-apps.ts`.
- Gate taxonomy: `governance/gates/gate-authority-registry.json` (39 gates).
- Readiness certifications: `docs/readiness/*`.
