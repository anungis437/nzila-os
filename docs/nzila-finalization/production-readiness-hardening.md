# Production Readiness Hardening

Authority: `master-finalization-index.md`. As of 2026-07-03.

The hardening deltas closed on the path to production graduation. Full detail and
per-phase evidence: `docs/readiness/full-production-readiness-delta.md`.

## Closed

- **Production surface freeze** — `validate:production-surface` green; 26 apps classified; 0 UNKNOWN.
- **Deploy authority** — removed long-lived `secrets.AZURE_CREDENTIALS` fallbacks (fail-closed OIDC); `validate:production-deploy-authority` green; internal-only apps not prod-promotable; structured non-expired production exceptions.
- **BR-6 org-context substrate** — single fail-closed canonical resolver; no silent default-org fallback; `validate:br6-org-context` green.
- **Azure runtime** — dedicated prod RG/env/DB/Log-Analytics (isolation verified); env-scoped OIDC federated credential; backup/HA posture; config fail-closed.
- **Artifact identity** — all three prod apps digest-pinned.
- **DNS/TLS** — production domains cut over to isolated prod apps with valid managed TLS.

## Security items surfaced (owner-tracked)

- A storage account key was found stored as a plaintext env value on the staging
  partners app. **CLOSED (2026-07-03):** key rotated by owner; partners-prod secret
  refreshed + restarted; staging partners plaintext moved to a secret reference —
  no plaintext key remains on either app.
- The shared API token used for the DNS cutover. **CLOSED (2026-07-03):** token
  rotated/revoked by owner; repo scan confirms no token value in tracked files.
