# R1 pilot Django sidecar — binding log

This log records substrate-cost reviewer-of-record actions that bind the pilot
Django sidecar (`nzila-os-union-eyes-django-pilot`) to the pilot Next app
(`nzila-os-union-eyes-pilot`). It is the operational ledger for the R1 closure
documented in `r1-pilot-django-sidecar-binding-closure.md`.

Each entry is bounded honest copy: it states what was done, by whom, what
verification passed, and what remains open. It does not inflate readiness.

## Schema

| field | meaning |
|---|---|
| timestamp | UTC ISO-8601 |
| reviewer | github handle of the substrate-cost actor |
| action | short verb (CREATE / BIND / VERIFY / ROTATE / WIRE) |
| target | container app, KV secret, PG resource, etc. |
| verification | what was probed and what status returned |
| residual | what remains open after this entry |

---

## 2026-05-10T01:53Z — CREATE + BIND + VERIFY (initial)

- reviewer: anungis437
- actions:
  - CREATE container app `nzila-os-union-eyes-django-pilot` in
    `nzila-canada-pilot-rg` / `nzila-canada-pilot-env`, image
    `nzilacanadaacr.azurecr.io/nzila-os-union-eyes-backend:e37c430dca24fc15887f41061007755464f2c55c`,
    internal ingress :8000, system-assigned identity OID
    `451de3d3-5634-4065-9940-9a805715f139`, cpu=1.0/mem=2.0Gi,
    `WEB_CONCURRENCY=3`, `PGSSLMODE=require`. ACR pull bootstrapped with
    admin credentials (system identity has no AcrPull at create time).
  - GRANT role `Key Vault Secrets User` on `nzila-canada-pilot-kv` to the
    sidecar OID.
  - BIND KV-backed secrets on the sidecar: `django-secret-key →
    django-secret-pilot`, `pgpassword → PILOT-PG-ADMIN-PASSWORD`,
    `auth-secret → auth-secret-pilot` (all `identityref:system`); wire env
    vars `DJANGO_SECRET_KEY`, `PGPASSWORD`, `AUTH_SECRET` via secretrefs.
  - ENSURE PG firewall: added rule `AllowAllAzureServicesAndResourcesWithinAzureIps`
    (0.0.0.0 → 0.0.0.0) on `nzila-canada-pilot-db`.
  - ENSURE PG database: created `nzila_union_eyes` on `nzila-canada-pilot-db`.
  - ROTATE PG admin password (44 chars, RNG-generated) and synchronize KV
    secrets `PILOT-PG-ADMIN-PASSWORD` and `database-url` (the latter previously
    held the pre-rotation password and was rebuilt with the new password while
    preserving host/database/sslmode tail).
  - WIRE Next pilot app: set `DJANGO_API_URL=http://nzila-os-union-eyes-django-pilot.internal.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`,
    set `HEALTH_REQUIRE_QUEUE=false` (queue gate disabled until Redis is
    provisioned), force a new Next revision (`kvrefresh-*` suffix) so the
    rotated `database-url` KV value is pulled.
- verification:
  - Sidecar gunicorn boot: `Listening at: http://0.0.0.0:8000`, all migrations
    applied (admin, ai_core, analytics, auth, auth_core, bargaining, billing,
    compliance, content, contenttypes, core, django_celery_beat,
    django_celery_results, grievances, notifications, services, sessions,
    unions). 4 OOM-killed workers on initial cpu=0.5/mem=1.0Gi —
    resolved by raising to cpu=1.0/mem=2.0Gi and `WEB_CONCURRENCY=3`.
  - Loopback probe (from inside sidecar):
    `curl -sS http://127.0.0.1:8000/api/auth_core/health/` → HTTP 200,
    body `{"status":"degraded","checks":{"db":true,"redis":false,"celery_broker":false}}`.
    "degraded" is expected: pilot tier has no Redis or Celery broker. The
    `db:true` confirms the sidecar's PG bind is healthy.
  - Internal FQDN probe (sidecar self-test via internal hostname):
    `curl http://nzila-os-union-eyes-django-pilot.internal.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io/api/auth_core/health/`
    → HTTP 200 with same body. Confirms ACA internal ingress is wired.
  - Public probe (from operator workstation):
    `https://pilot.unioneyes.app/api/health` → HTTP 200,
    body `{"status":"ok","checks":{"process":"ok","database":"ok"}}`.
    Confirms Next runtime + DB binding healthy.
  - Public ready probe:
    `https://pilot.unioneyes.app/api/ready` → HTTP 200,
    body `{"ready":true,"status":"ready",...}`.
- residual:
  - Pilot has no Redis or Celery broker; Django reports `status:degraded` from
    `/api/auth_core/health/` because `redis:false` and `celery_broker:false`.
    `HEALTH_REQUIRE_QUEUE=false` on the Next app keeps `/api/health` green.
    Provisioning Redis closes the queue gate but is **out of scope** for R1.
  - Sidecar uses ACR admin credentials for image pull; should be migrated to
    AcrPull via system-assigned identity once the bootstrapping race is no
    longer a concern (cleanup task; non-blocking).
  - Cross-app fetch from Next runtime to Django was not directly observed via
    Next runtime logs (Next 16.2 streaming logs hit a Windows
    `cp1252` encoding issue in the Azure CLI logs viewer). The proof relied on
    sidecar-side response capture and the green `database` check on Next.
    A direct Next-runtime cross-app probe trace remains a deferred follow-up.
  - The ACR repo name is `nzila-os-union-eyes-backend`, not `-django` as
    earlier doctrine drafts implied; doctrine has been updated.
  - Tier 2 verdict remains **CONDITIONAL GO** even after green probes — a
    single deploy is a binding event, not a stewardship cadence. The
    binding-log itself is the cadence artifact going forward.
