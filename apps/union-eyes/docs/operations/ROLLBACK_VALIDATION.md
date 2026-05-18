# UnionEyes — Rollback Validation (B2C)

Status: **validated** — rollback drill executed `2026-05-17T18:45:00Z`.
See appendix below for captured evidence.

## Prerequisite verification

`az containerapp revision list` shows that the prod app retains prior
revisions for rollback. Container Apps in `Single` revision mode keep
previous revisions in `Inactive` state until garbage-collected per the
environment's revision retention policy.

To inspect available rollback targets at any time:

```powershell
az containerapp revision list `
  -n nzila-os-union-eyes-prod `
  -g nzila-canada-prod-rg `
  --query "[].{name:name, active:properties.active, healthState:properties.healthState, createdTime:properties.createdTime, image:properties.template.containers[0].image}" `
  -o table
```

## Rollback procedure

1. Identify last known-good revision N-1 from the list above.
2. Move 100 % traffic to N-1 (Single mode):

   ```powershell
   az containerapp revision activate `
     -n nzila-os-union-eyes-prod `
     -g nzila-canada-prod-rg `
     --revision <revision-N-1>
   az containerapp ingress traffic set `
     -n nzila-os-union-eyes-prod `
     -g nzila-canada-prod-rg `
     --revision-weight <revision-N-1>=100
   ```

3. Curl `/api/health` against the prod FQDN; require HTTP 200 with
   `checks.database.status == "ok"` and `checks.auth.status == "ok"`.
4. Capture revision SHA, rollback duration, and post-rollback smoke
   results in a new appendix to this file.

## Database compatibility

UE migrations are forward-only and reviewed under
`migrations/`. Before any rollback that crosses a migration boundary,
verify:

- No destructive migration has been applied in the interval being
  rolled back over.
- Application code at N-1 can read the current schema state.

This must be confirmed per-rollback; it cannot be pre-declared safe.

In the B2C drill: no migrations were crossed (drill used same image,
different env var only). Schema compatibility was not a factor.

---

## Rollback drill — executed `2026-05-17T18:45:00Z`

### Setup

| Item | Value |
|---|---|
| Drill type | Traffic shift: env-var-only revision swap |
| N revision (drill) | `nzila-os-union-eyes-prod--0000044` (added `ROLLBACK_DRILL_MARKER` env var) |
| N-1 revision (rollback target) | `nzila-os-union-eyes-prod--0000043` (clean, same image) |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:3c43cf116...` (same for both) |
| Mode transition | Single → Multiple (required to set traffic weights) |

### Rollback steps executed

1. Created drill revision `--0000044` via `az containerapp update --set-env-vars ROLLBACK_DRILL_MARKER=2026-05-17-b2c-drill`
2. Switched revision mode to `Multiple` via `az containerapp revision set-mode --mode multiple`
3. Set 100% traffic to `--0000043` via `az containerapp ingress traffic set --revision-weight --0000043=100`
4. Re-activated `--0000043` (mode switch had deactivated it)
5. Verified health and smoke on `--0000043`
6. Deactivated `--0000044` (drill revision)
7. Restored clean state: removed `ROLLBACK_DRILL_MARKER` env var → created clean `--0000045`
8. Switched back to Single revision mode

### Operational note (single vs multiple mode)

In ACA Single revision mode, `az containerapp ingress traffic set` is
unavailable. Rollback requires temporarily switching to Multiple revision
mode. When switching back to Single mode, ACA activates the **latest**
revision (by creation timestamp), not the one you just rolled back to.
**Correct rollback procedure in Single mode:**

```powershell
# 1. Switch to Multiple mode
az containerapp revision set-mode -n <app> -g <rg> --mode multiple
# 2. Activate the rollback target
az containerapp revision activate -n <app> -g <rg> --revision <target>
# 3. Shift traffic to it
az containerapp ingress traffic set -n <app> -g <rg> --revision-weight <target>=100
# 4. Deactivate the bad revision
az containerapp revision deactivate -n <app> -g <rg> --revision <bad>
# 5. Deploy a clean revision (removes any temp env vars, ensures "latest" = known-good)
# Then switch back to Single mode
```

### Captured timings

| Event | Duration |
|---|---|
| `--0000044` create → healthy | ~10s |
| Mode switch + traffic set | ~7s |
| `--0000043` re-activate → healthy | ~16s |
| Full rollback drill (activate → smoke pass) | **~23s** |
| Clean-up (remove marker, create `--0000045`) | ~60s |

### Post-rollback smoke (on `--0000043`)

| Endpoint | Result |
|---|---|
| `/api/health` | HTTP 200, `status: degraded`, `ok: true`, `db.status: ok`, `auth.status: ok` |
| `/api/health/liveness` | HTTP 200 |
| `/api/metrics/operational` | HTTP 401 (correct — auth-gated) |
| `/api/governance/telemetry` | HTTP 401 (correct — auth-gated) |

### Post-drill final state (on `--0000045` — clean prod revision)

| Endpoint | Result |
|---|---|
| `/api/health` | HTTP 200, `status: degraded`, `ok: true`, `db.status: ok` |
| `/api/metrics/operational` | HTTP 401 ✅ |

### Acceptance criteria met

- [x] Actual revision activation executed against `nzila-os-union-eyes-prod`
- [x] Rollback duration captured: **23s**
- [x] Health transition captured: 200 (ok, degraded) → maintained through rollback
- [x] Governance telemetry and evidence export paths: auth-gated but not broken
- [ ] Cross-migration rollback boundary: not tested in this drill (same image used)
- [x] App recovered cleanly to clean state (`--0000045`)
