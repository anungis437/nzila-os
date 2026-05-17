# UnionEyes — Incident Drill Report (B4C)

Status: **informal drill captured**, formal drill **deferred**.

## Informal drill — Django backend unreachable (observed live)

During Phase B B3A smoke capture, the live `/api/health` endpoint
returned:

```
{
  "ok": true,
  "status": "degraded",
  ...
  "checks": {
    "database": { "status": "ok", "critical": true, "ms": 163 },
    "auth":     { "status": "ok", "critical": true },
    "redis":    { "status": "ok", "note": "Redis not configured — optional for this deployment" },
    "backend":  { "status": "degraded", "note": "unreachable" }
  }
}
```

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

## Formal drill — to be executed

Recommended scenarios (one each, with timestamped capture):

1. **Expired secret** — rotate `AUTH_SECRET` in KV without rolling the
   ACA revision; observe auth check transition and alert response.
2. **Failed deploy** — push an image whose `/api/health` returns 503;
   confirm Container Apps blocks promotion.
3. **DB timeout** — temporarily lower PG max_connections and saturate;
   observe health endpoint behaviour and rollback path.
4. **Telemetry outage** — block egress to LAW for a short window;
   confirm app continues serving and alerts fire on log silence.

Each formal drill must produce: timestamps, detection mechanism, time
to acknowledge, time to recover, captured artifacts, postmortem notes.
