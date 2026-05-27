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

---

## 2026-05-10T02:05Z — BIND Upstash Redis (REST + native), close queue gate

- reviewer: anungis437
- actions:
  - STORE Upstash credentials in `nzila-canada-pilot-kv`:
    - `UPSTASH-REDIS-REST-URL` = REST endpoint (Upstash project
      `hot-lamb-120369`, region eu-west-1; full host stored in KV only).
    - `UPSTASH-REDIS-REST-TOKEN` = REST token (treat as exposed in transcript;
      rotate from Upstash console — see residuals).
    - `UPSTASH-REDIS-URL` = canonical native `rediss://` URL from the Upstash
      console "Connect" tab; full value stored in KV only. Upstash's
      documented native auth uses the REST token as the RESP AUTH password
      (single credential, two protocols).
  - BIND on Next pilot app (`nzila-os-union-eyes-pilot`):
    - secret `upstash-redis-rest-url` → KV `UPSTASH-REDIS-REST-URL`
    - secret `upstash-redis-rest-token` → KV `UPSTASH-REDIS-REST-TOKEN`
    - env `UPSTASH_REDIS_REST_URL=secretref:upstash-redis-rest-url`
    - env `UPSTASH_REDIS_REST_TOKEN=secretref:upstash-redis-rest-token`
  - BIND on Django sidecar (`nzila-os-union-eyes-django-pilot`):
    - secret `redis-url` → KV `UPSTASH-REDIS-URL`
    - env `REDIS_URL=secretref:redis-url`
    - env `CELERY_BROKER_URL=secretref:redis-url`
  - REVISION-SUFFIX `redis-220132` on both apps to force KV pull.
  - RE-ENABLE strict queue gate on Next: `HEALTH_REQUIRE_QUEUE=true`.
- verification:
  - Operator REST round-trip against the Upstash REST endpoint:
    `set/get/del` returned `{"result":"OK"}` / `{"result":"ok"}` /
    `{"result":1}`.
  - Django sidecar `/api/auth_core/health/` (loopback exec) →
    `{"status":"ok","checks":{"db":true,"redis":true,"celery_broker":true}}`.
  - Public `https://pilot.unioneyes.app/api/health` →
    `{"status":"ok","checks":{"process":"ok","database":"ok","queue":"ok"}}`.
  - Public `https://pilot.unioneyes.app/api/ready` →
    `{"ready":true,"status":"ready",...}`.
  - Latest Next revision: `nzila-os-union-eyes-pilot--0000008`.
- residual:
  - **Upstash REST token exposed in operator transcript twice.** Rotate from
    Upstash console; then update both `UPSTASH-REDIS-REST-TOKEN` and
    `UPSTASH-REDIS-URL` in `nzila-canada-pilot-kv` (token is embedded in the
    native URL), then revision-suffix bump both pilot apps. This is the
    single P0 left for Tier 2 verdict to lift to FULL GO.
  - **No Celery worker** is provisioned in pilot. Broker accepts tasks; nobody
    consumes them. Out of scope for R1; track separately if/when async
    features are exercised in pilot.
  - Upstash now sits inside the trust boundary. It MUST appear in the
    dependency-rotation log when that cadence is formalized (see
    `r8-provider-key-rotation-cadence.md`).
  - Tier 2 verdict remains **CONDITIONAL GO** until the token is rotated
    out-of-band. After rotation, this entry should be amended with a final
    `2026-05-10T??Z — ROTATE Upstash REST token` event.

---

## 2026-05-10T02:16Z — ROTATE PG admin password (handled-by-operator → fresh)

- reviewer: anungis437
- rationale: prior `nzila` admin password was generated and embedded in the
  KV `database-url` secret mid-session, exposing the rotated value to
  transcript handling. Re-rotated to a fresh 44-char RNG value never written
  to chat output.
- actions:
  - Generated new 44-char base64url password via
    `RandomNumberGenerator.GetBytes(33)`; persisted to
    `.cache/pilot-pg-pwd-rot2.txt` (gitignored).
  - `az postgres flexible-server update --admin-password` on
    `nzila-canada-pilot-db` → returned name (success).
  - `az keyvault secret set` on `nzila-canada-pilot-kv`:
    - `PILOT-PG-ADMIN-PASSWORD` → new password
    - `database-url` → rebuilt `postgresql://nzila:<urlencoded-pwd>@...`
      preserving host/db/sslmode tail (length-stable proof: 143 → 143).
  - REVISION-SUFFIX `pgrot-221527` on both pilot apps to force KV pull.
- verification:
  - Public `/api/health` → `{"checks":{"process":"ok","database":"ok","queue":"ok"}}`.
  - Public `/api/ready` → `{"ready":true}`.
  - Django sidecar loopback `/api/auth_core/health/` →
    `{"status":"ok","checks":{"db":true,"redis":true,"celery_broker":true}}`.
  - Both new revisions: `*--pgrot-221527`.
- residual:
  - **Upstash REST token still pending out-of-band rotation** (operator must
    rotate from Upstash console; agent has no console access). Once rotated:
    update `UPSTASH-REDIS-REST-TOKEN` + `UPSTASH-REDIS-URL` in KV, bump
    revisions, append rotation entry. This is the LAST P0 blocker for
    Tier 2 verdict to lift to FULL GO.
  - PG admin password rotation should be added to the formalized
    dependency-rotation cadence (see `r8-provider-key-rotation-cadence.md`)
    rather than relying on incident-driven rotations.

---

## 2026-05-10T02:35Z — ROTATE Upstash REST token (operator-initiated, FULL GO)

- reviewer: anungis437
- rationale: prior REST token was exposed in operator transcript twice during
  the initial Upstash binding (2026-05-10T02:05Z entry). Single P0 blocker
  remaining for Tier 2 verdict to lift to FULL GO.
- actions:
  - Operator rotated the REST token from the Upstash console (no agent path).
  - Ran `tooling/scripts/r1-pilot-upstash-token-rotate.ps1` with the new
    token. Script flow:
    1. Snapshotted current KV state to
       `.cache/upstash-rotate-snapshot-20260509-223339.json` (gitignored).
    2. Pre-flight: REST `set/get/del` round-trip with new token against
       the live Upstash endpoint → `OK` / `ok` / `1`.
    3. Rebuilt native `rediss://` URL preserving host:port (length-stable
       111 → 111).
    4. Updated KV secrets in `nzila-canada-pilot-kv`:
       `UPSTASH-REDIS-REST-TOKEN` (verbatim new token),
       `UPSTASH-REDIS-URL` (rebuilt native).
    5. Revision-suffix bump `tokrot-223353` on both pilot apps to force KV
       re-resolution.
- verification:
  - public `/api/health`  → `{"status":"ok","checks":{"process":"ok","database":"ok","queue":"ok"}}`
  - public `/api/ready`   → `{"ready":true}`
  - Django sidecar loopback → `{"status":"ok","checks":{"db":true,"redis":true,"celery_broker":true}}`
    (`upstash_rest` field absent — sidecar image predates the
    `upstash-redis` SDK addition; the field will appear on the next
    Django sidecar image rebuild and is informational only).
- script residual:
  - First rotation attempt (`tokrot-223131`) triggered a false-negative
    rollback because the verification parser used `Select-Object -Last 1`
    on `az containerapp exec` output, which picks up the trailing
    `INFO: received success status from cluster` line instead of the JSON.
    Fixed by extracting the first `{...}` JSON object via regex from the
    combined stream. The rollback was correct (KV restored), but the
    rotation had actually succeeded — the running revision had pulled the
    new token before rollback. Re-ran with the fixed parser; reconciled
    cleanly.
  - Snapshots from both attempts retained in `.cache/`. The aborted
    snapshot can be deleted after verifying KV state.
- verdict:
  - **Tier 2 lifts from CONDITIONAL GO → FULL GO** for the Upstash
    credential surface. Token rotation is now scripted, transactional,
    and rollback-safe.
  - Upstash credential rotation MUST be folded into
    `r8-provider-key-rotation-cadence.md` as a formalized cadence (next
    rotation due ≤ 90 days).
    A direct Next-runtime cross-app probe trace remains a deferred follow-up.
  - The ACR repo name is `nzila-os-union-eyes-backend`, not `-django` as
    earlier doctrine drafts implied; doctrine has been updated.
  - Tier 2 verdict remains **CONDITIONAL GO** even after green probes — a
    single deploy is a binding event, not a stewardship cadence. The
    binding-log itself is the cadence artifact going forward.

---

## 2026-05-26T02:52Z — VERIFY (post-binding runtime check)

- reviewer: anungis437
- actions:
  - VERIFIED pilot Azure substrate from operator shell (`az account show`,
    `az containerapp list -g nzila-canada-pilot-rg`).
  - VERIFIED pilot Django sidecar app presence:
    `nzila-os-union-eyes-django-pilot` is present in the pilot resource group.
  - VERIFIED sidecar revision health:
    `nzila-os-union-eyes-django-pilot--tokrot-223353` is `Active=True`,
    `Health=Healthy`, replicas present.
- verification:
  - Public probe `https://pilot.unioneyes.app/api/auth_core/health` →
    **HTTP 200**.
  - Response body includes `{"status":"ok", ... "checks":{"process":"ok","database":"ok","queue":"ok"}}`.
- residual:
  - Degraded-sidecar drill (scale to 0 → assert bounded 503 copy → restore)
    was not replayed in this verifier pass; keep cadence requirement active.
  - Aggregate doctrine rows that still mark R1 as deferred need explicit
    reviewer-of-record refresh once the degraded drill replay artifact is
    attached for this cycle.

---

## 2026-05-26T03:00Z — DRILL-ATTEMPT (bounded degraded path)

- reviewer: anungis437
- actions:
  - ATTEMPTED sidecar scale-to-zero drill with
    `az containerapp update ... --min-replicas 0 --max-replicas 0` on
    `nzila-os-union-eyes-django-pilot`.
  - Azure control-plane rejected the request with
    `--max-replicas must be in the range [1,1000]`.
  - ATTEMPTED equivalent fail-path drill by temporarily setting pilot app
    `DJANGO_API_URL` to an unreachable host, probing
    `https://pilot.unioneyes.app/api/auth_core/health`, then restoring.
  - RESTORED pilot app env to pre-drill state:
    `DJANGO_API_URL=http://nzila-os-union-eyes-django-pilot.internal.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`
    and removed temporary `NEXT_PUBLIC_DJANGO_API_URL`.
- verification:
  - During fail-path attempt, public probe remained **HTTP 200** with
    `{"status":"ok", ... "checks":{"process":"ok","database":"ok","queue":"ok"}}`.
  - This indicates pilot is still serving the pre-fail-closed auth-core health
    behavior (alias surface), not the new bounded-503 route implementation.
- residual:
  - Required next closure action is a pilot frontend rollout carrying
    `apps/union-eyes/app/api/auth_core/health/route.ts` fail-closed logic,
    followed by a replayed degraded drill artifact.
  - Until that rollout happens, degraded-path verification for this cycle
    cannot be certified as complete.
