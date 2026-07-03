# Production / Staging Infrastructure Isolation Certification (Phase 5)

- **As of:** 2026-07-03 · **verified via Azure CLI** (supersedes the Phase 4A
  "SHARED AND BLOCKED" verdict, which was based on stale inventory metadata).

## Verdict

```
ISOLATED  (union-eyes production)
```

Live Azure state proves union-eyes production is isolated from staging; the
`deployment-inventory.json` `sharedWithStaging: true` metadata was **stale and
wrong** and has been corrected.

## Evidence (az CLI, 2026-07-03)

| Boundary | Production | Staging | Isolated? |
| --- | --- | --- | --- |
| Resource group | `nzila-canada-prod-rg` | `nzila-canada-staging-rg` | ✅ |
| Container App env | `nzila-canada-prod-env` | `nzila-canada-staging-env` | ✅ |
| Container app | `nzila-os-union-eyes-prod` | `nzila-os-union-eyes-staging` | ✅ |
| Database | `nzila-os-union-eyes-prod-db` | `nzila-staging-db` | ✅ |
| Log Analytics | `nzila-canada-prod-law` | staging workspace | ✅ |
| Runtime flag | `ENVIRONMENT_ISOLATION=full` | — | ✅ |

Production ingress is production-domain scoped (`app.unioneyes.app`, external,
managed TLS, live 200). Secrets are in the Container App secret store
(`SECRET_TOPOLOGY=aca-kv-integrated`), not shared staging plaintext.

## Correction applied

`deployment-inventory.json` `topology.production` updated to `nzila-canada-prod-rg`
/ `nzila-canada-prod-env` / `sharedWithStaging: false` (`verifiedBy: az CLI 2026-07-03`).

## Scope limitation

ISOLATED applies to **union-eyes** only. `web`/`partners` run **only** in
`nzila-canada-staging-env` (no isolated production runtime) → isolation
`N/A (no production runtime)`. See
[production-app-graduation-certification.md](production-app-graduation-certification.md).

---

## Historical (Phase 4A — superseded)

The prior verdict below was based on repo metadata, now refuted by live Azure.

## Why BLOCKED (not "shared with approved exception")

A shared production/staging topology is production-blocking unless an approved
exception exists with **owner, non-expired expiry, rollback plan, blast-radius
analysis, and monitoring**. The only related exception in the inventory is the
per-app `rollbackException` which **expired 2026-06-30**. There is no valid
infrastructure-isolation exception. No fake exception was created to pass.

## Required to reach ISOLATED

- Dedicated production resource group (e.g. `nzila-canada-prod-rg`) and Container
  App environment (e.g. `nzila-canada-prod-env`) separate from staging.
- Update `deployment-inventory.json` `topology.production` to the dedicated RG/env
  and set `sharedWithStaging = false`.
- **`EXTERNAL IMPLEMENTATION REQUIRED`:** the actual RG/CA-environment split is an
  Azure-side change outside this repo. (Note: some UE production runtime already
  runs in `nzila-canada-prod-env`/`nzila-canada-prod-rg` per runtime-separation
  live verification — reconcile the inventory topology with live state.)

## Interim control

`resolve-deploy-apps.ts` + `validate-production-deploy-authority` bound *which*
apps may promote to production, reducing (not eliminating) shared-infra risk.
