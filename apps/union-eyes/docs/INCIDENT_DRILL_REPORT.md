# UnionEyes — Incident Drill Report (B4C)

Status: **Drill 1 (failed deploy) executed and validated `2026-05-17T19:18:22Z`.** Drill 2 (informal backend degraded) captured live. Drills 3–5 deferred (maintenance window required).

## Formal Drill 1 — Failed Deploy (image pull failure)

**Date:** `2026-05-17T19:18:22Z`
**Scenario:** Deploy a revision with a non-existent container image tag.
**Risk:** Nil — executed in multiple-revision mode with 100% traffic pinned to the healthy revision.

### Timeline

| Time (UTC) | Event |
|---|---|
| `2026-05-17T19:17:27Z` | Drill start — mode switch to Multiple, traffic pinned to `--0000049` (100%) |
| `2026-05-17T19:18:22Z` | `az containerapp update --image nzilacanadaacr.azurecr.io/nzila-os-union-eyes:does-not-exist-drill` issued |
| `2026-05-17T19:18:37Z` | ACA control plane fast-failed: `MANIFEST_UNKNOWN: manifest tagged by "does-not-exist-drill" is not found` |
| `2026-05-17T19:18:37Z` | Bad revision never activated; traffic remains 100% on `--0000049` |
| `2026-05-17T19:18:47Z` | Mode restored to Single |
| `2026-05-17T19:19:08Z` | Production smoke confirmed: `db:ok 113ms`, `auth:ok`, `redis:ok 67ms` |

**Total drill duration:** ~82 seconds.
**Production impact:** Zero — traffic never diverted from `--0000049`.

### Detection mechanism

ACA control plane performs an ACR manifest lookup at revision creation time. An unknown tag triggers an immediate provisioning error:

```
Failed to provision revision for container app 'nzila-os-union-eyes-prod'.
Error details: template.containers.nzila-os-union-eyes-prod.image is invalid:
MANIFEST_UNKNOWN: manifest tagged by "does-not-exist-drill" is not found
```

Exit code 1 returned to CLI/CI; deployment pipeline fails fast.

### Recovery path

1. No rollback required — bad revision was never activated.
2. In a CI/CD pipeline scenario: re-push a known-good image tag and re-run deployment.
3. In manual deployment: `az containerapp update --image <good-tag>`.

### Postmortem notes

- ACA's fast-fail on missing image is a **free safety gate** — no startup probe required to catch image pull failures.
- The multiple-revision mode pattern (pin traffic → deploy bad → observe fail → restore) is the recommended approach for drill execution without production impact.
- CI pipeline should enforce image-exists check (ACR manifest inspect) before deploying.
- Alert `ue-prod-health-503-sustained` would fire within 5 minutes if a bad revision somehow reached production and caused 503s — wired action group `ue-prod-ops-alerts` → `ops@nzila.ca`.

## Informal Drill 2 — Django Backend Unreachable (observed live)

During Phase B B3A smoke capture, the live `/api/health` endpoint
returned:

```json
{
  "ok": true,
  "status": "degraded",
  "checks": {
    "database": { "status": "ok", "critical": true, "ms": 113 },
    "auth":     { "status": "ok", "critical": true },
    "redis":    { "status": "ok", "ms": 67 },
    "backend":  { "status": "degraded", "note": "unreachable" }
  }
}
```

Observed continuously from `2026-05-17T18:34:00Z` (pilot window open) through `2026-05-17T19:19:08Z` (post-drill smoke). Django backend has been unreachable from prod throughout Phase B.

### Detection
The health endpoint contract correctly classified the Django backend
as `degraded` (non-critical). Overall `ok:true` was preserved because
no critical dependency was failing.

### Response (recommended)
1. Confirm whether prod is intended to run backend-less. If yes, mark
   `backend` as non-critical permanently and update the health check
   note to say "Django backend not deployed in this environment".
2. If no, restore Django backend connectivity:
   - Confirm `DJANGO_API_URL` resolves from inside the ACA env.
   - Confirm egress NSG / private endpoint rules.
   - Confirm backend health independently.

### Lessons captured
- The health contract did exactly what Phase A designed: honest amber,
  not false green.
- Non-critical-degraded should still trigger a low-severity alert; this
  alert path has not yet been observed firing.

## Deferred Drills (maintenance window required)

Recommended scenarios requiring a maintenance window or staging environment:

1. **Expired secret** — rotate `AUTH_SECRET` in KV without rolling the ACA revision; observe auth check transition and alert response. Risk: invalidates all active user sessions.
2. **DB timeout** — temporarily lower PG `max_connections` and saturate; observe health endpoint behaviour and rollback path. Risk: brief DB unavailability.
3. **Telemetry outage** — block egress to LAW for a short window; confirm app continues serving and alerts fire on log silence. Risk: requires network policy or NSG rule change.
4. **Alert fire drill** — temporarily expose health 503 conditions to confirm `ue-prod-ops-alerts` action group fires email to `ops@nzila.ca`.

Each deferred drill must produce: timestamps, detection mechanism, time to acknowledge, time to recover, captured artifacts, postmortem notes. Schedule during low-traffic window with incident owner present.

**Incident owner:** `ops@nzila.ca` (Platform). Escalation: on-call via same address.
