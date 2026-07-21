# 18 — Staging Attestation (Wave 0 §9)

**Programme state:** `PARTIALLY_IMPLEMENTED`.
**Recorded:** 2026-07-21 during Wave 0 continuation.
**Source of truth:** Azure Resource Manager, retrieved with the
`az containerapp show` CLI. Only NAMES of environment variables
and secrets are recorded — no values of any secret are copied here
or into any file in this repository.
**Subscription:** `5d819f33-d16f-429c-a3c0-5b0e94740ba3` (`nzila-canada`).

## Executive summary

- The staging revision `nzila-os-union-eyes-staging--0000089` and the
  pilot revision `nzila-os-union-eyes-pilot--0000060` both run
  container image
  `nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:838149de7d43ca8ac5ca8a957e04a6e0f88517fedc39830283eec791e93c6658`.
- That image was built from commit `c77f0cf091ddd7b54085d90a3583c1b46b7de003` — the branch base of
  `fix/union-eyes-reality-remediation`. **It does NOT contain any of the Wave 0 remediation code recorded in this branch.**
- Therefore this attestation records the pre-remediation baseline
  and is **the honest starting point** for §10 pilot-critical work.
- No hosted environment has yet run the boot-time demo-deployment
  guard, the §7 operational probes, or the anti-theatre scanner
  gate. Any claim that staging or pilot demonstrates the Wave 0
  containment work is theatre and MUST be refused.

## Environments discovered

Discovered via `az containerapp list`:

| App name | Resource group | Environment domain |
|----------|----------------|--------------------|
| `nzila-os-union-eyes-staging` | `nzila-canada-staging-rg` | `jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |
| `nzila-os-union-eyes-pilot` | `nzila-canada-pilot-rg` | `thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io` |
| `nzila-os-union-eyes-django-pilot` | `nzila-canada-pilot-rg` | (Django sidecar) |
| `nzila-os-union-eyes-demo` | `nzila-canada-demo-rg` | (demo) |
| `nzila-os-union-eyes-prod` | `nzila-canada-prod-rg` | (production) |

**Correction to `nzila-automation.md` user memory:** the staging
container app is named `nzila-os-union-eyes-staging`, not
`nzila-os-union-eyes`. The prior memory entry was stale and MUST
be updated.

## Staging — `nzila-os-union-eyes-staging`

**Region:** Canada Central. **Resource group:** `nzila-canada-staging-rg`.

- Active revision: `nzila-os-union-eyes-staging--0000089`
- Image digest: `sha256:838149de7d43ca8ac5ca8a957e04a6e0f88517fedc39830283eec791e93c6658`
- Target port: `3000`
- FQDN: `nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`
- Provisioning state: `Succeeded`

### Non-secret env values (names + values)

Values shown only because they are non-secret. Every entry
labelled below as "secret ref" appears again in the next
subsection with names only.

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `NEXT_PUBLIC_APP_ENV` | `staging` |
| `UE_ENVIRONMENT` | `staging` |
| `UE_DEPLOYMENT_TYPE` | `staging` |
| `UE_FEATURE_PROFILE` | `internal` |
| `NZILA_MODE` | `staging` |
| `GITHUB_SHA` | `c77f0cf091ddd7b54085d90a3583c1b46b7de003` |
| `RELEASE_ID` | `UE-2026-07-20-c77f0cf` |
| `BUILD_TIME` | `2026-07-20T23:42:23Z` |
| `BUILD_TIMESTAMP` | `2026-07-20T23:42:23Z` |
| `ARTIFACT_ID` | `c77f0cf091ddd7b54085d90a3583c1b46b7de003` |
| `UE_MARKETING_URL` | `https://staging.unioneyes.app` |
| `UE_APP_URL` | `https://staging-app.unioneyes.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://staging.unioneyes.app` |
| `NEXT_PUBLIC_APP_URL` | `https://staging-app.unioneyes.app` |
| `NEXT_PUBLIC_SITE_URL_STAGING` | `https://staging.unioneyes.app` |
| `NEXT_PUBLIC_APP_URL_STAGING` | `https://staging-app.unioneyes.app` |
| `AUTH_URL` | `https://staging-app.unioneyes.app` |
| `AUTH_TRUST_HOST` | `true` |
| `DJANGO_API_URL` | `http://127.0.0.1:8000` |
| `PLATFORM_ADMIN_USER_IDS` | `user_35NlrrNcfTv0DMh2kzBHyXZRtpb,user_37Zo7OrvP4jy0J0MU5APfkDtE2V` |
| `SUPER_ADMIN_ORG_ID` | (empty) |
| `PGHOST` | `nzila-staging-db.postgres.database.azure.com` |
| `PGUSER` | `nzilaadmin` |
| `PGDATABASE` | `nzila_os_staging` |
| `PGSSLMODE` | `require` |
| `AZURE_EVIDENCE_STORAGE_CONTAINER` | `union-eyes-evidence-staging` |
| `SECRET_TOPOLOGY` | `aca-inline-staging` |
| `SECRET_AUTHORITY` | `staging-kv-operator` |
| `ENVIRONMENT_ISOLATION` | `full` |
| `NEXT_PUBLIC_UE_FEATURE_PROFILE` | `internal` |
| `NEXT_PUBLIC_DJANGO_API_URL` | `http://127.0.0.1:8000` |
| `READY_REQUIRE_QUEUE` | `false` |

### Env vars bound to secretRef (names only)

`DATABASE_URL`, `AUTH_SECRET`, `VOTING_SECRET`,
`FALLBACK_ENCRYPTION_KEY`, `EVIDENCE_SEAL_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`AUTH_WEBHOOK_SECRET`, `DJANGO_SECRET_KEY`,
`AZURE_AD_CLIENT_SECRET`.

### Container Apps secrets (names only)

`enc-key`, `upstash-redis-token`, `database-url`,
`upstash-redis-url`, `auth-webhook-secret`, `django-secret`,
`nzilacanadaacrazurecrio-nzilacanadaacr`, `pii-key`,
`voting-secret`, `azure-ad-client-secret`, `db-password`.

### Findings — staging

| ID | Severity | Finding |
|----|---------:|---------|
| S-01 | HIGH | `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID` are **NOT** configured on staging. Entra SSO will fall back / fail — only email+password auth (per `@nzila/platform-auth`) can work on staging today. |
| S-02 | HIGH | `TARGET_ENVIRONMENT` is not set. Our new demo-deployment-guard fail-closed default is `production`; with `UE_FEATURE_PROFILE=internal` the guard would allow, but this only holds if a later revision that CONTAINS the guard is deployed. Currently no deployed revision contains it. |
| S-03 | MEDIUM | `PLATFORM_ADMIN_USER_IDS` uses `user_XXX` legacy Clerk-shaped identifiers even though Clerk was removed. Verify these IDs match rows in `auth_users` (post-migration) or update to email-based identifiers. |
| S-04 | MEDIUM | `SUPER_ADMIN_ORG_ID` is empty. Admin-scoped operations that depend on it will silently no-op or fall back — verify against pilot org UUID. |
| S-05 | INFO | Staging runs `NODE_ENV=production`, `UE_FEATURE_PROFILE=internal`, `NZILA_MODE=staging`. Feature profile is consistent with the internal staging use-case. |
| S-06 | INFO | No `TARGET_ENVIRONMENT`, no `NEXT_PUBLIC_UE_DEMO_PROFILE` — staging is not currently declared as demo or dev. Once the Wave 0 image is deployed, the guard requires setting `TARGET_ENVIRONMENT=staging`. |

## Pilot — `nzila-os-union-eyes-pilot`

**Region:** Canada Central. **Resource group:** `nzila-canada-pilot-rg`.

- Active revision: `nzila-os-union-eyes-pilot--0000060`
- Image digest: `sha256:838149de7d43ca8ac5ca8a957e04a6e0f88517fedc39830283eec791e93c6658` (identical to staging)
- Target port: `3000`
- FQDN: `nzila-os-union-eyes-pilot.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`
- Provisioning state: `Succeeded`
- Revision tag: `pilot-rev2-fully-wired`

### Non-secret env values (names + values)

| Name | Value |
|------|-------|
| `NZILA_MODE` | `pilot` |
| `NODE_ENV` | `production` |
| `ENVIRONMENT_ISOLATION` | `full` |
| `SECRET_TOPOLOGY` | `isolated` |
| `SECRET_AUTHORITY` | `nzila-canada-pilot-kv` |
| `RUNTIME_FAIL_CLOSED` | `true` |
| `REVISION_TAG` | `pilot-rev2-fully-wired` |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1,nzila-os-union-eyes-pilot.thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io,pilot.unioneyes.app` |
| `UE_PILOT_APP_DOMAIN` | `pilot.unioneyes.app` |
| `AZURE_AD_CLIENT_ID` | `b7b0cb9a-110d-4bf4-baa7-d936d7450181` |
| `AZURE_AD_TENANT_ID` | `5082b8be-b04d-4a13-b61c-b6397670177b` |
| `DJANGO_API_URL` | `http://nzila-os-union-eyes-django-pilot` |
| `HEALTH_REQUIRE_QUEUE` | `true` |
| `PORT` | `3000` |
| `NEXT_PUBLIC_APP_ENV` | `pilot` |
| `UE_ENVIRONMENT` | `pilot` |
| `UE_DEPLOYMENT_TYPE` | `pilot` |
| `UE_FEATURE_PROFILE` | `executive` |
| `NEXT_PUBLIC_UE_FEATURE_PROFILE` | `executive` |
| `GITHUB_SHA` | `c77f0cf091ddd7b54085d90a3583c1b46b7de003` |
| `RELEASE_ID` | `UE-2026-07-20-c77f0cf` |
| `BUILD_TIME` | `2026-07-20T23:42:03Z` |
| `BUILD_TIMESTAMP` | `2026-07-20T23:42:03Z` |
| `ARTIFACT_ID` | `c77f0cf091ddd7b54085d90a3583c1b46b7de003` |
| `UE_MARKETING_URL` | `https://pilot.unioneyes.app` |
| `UE_APP_URL` | `https://pilot.unioneyes.app` |
| `NEXT_PUBLIC_SITE_URL` | `https://pilot.unioneyes.app` |
| `NEXT_PUBLIC_APP_URL` | `https://pilot.unioneyes.app` |
| `NEXT_PUBLIC_SITE_URL_STAGING` | `https://staging.unioneyes.app` |
| `NEXT_PUBLIC_APP_URL_STAGING` | `https://staging-app.unioneyes.app` |
| `AUTH_URL` | `https://pilot.unioneyes.app` |
| `AUTH_TRUST_HOST` | `true` |
| `PLATFORM_ADMIN_USER_IDS` | `user_35NlrrNcfTv0DMh2kzBHyXZRtpb,user_37Zo7OrvP4jy0J0MU5APfkDtE2V` |
| `SUPER_ADMIN_ORG_ID` | (empty) |
| `NEXT_PUBLIC_DJANGO_API_URL` | `http://nzila-os-union-eyes-django-pilot` |
| `READY_REQUIRE_QUEUE` | `true` |

### Env vars bound to secretRef (names only)

`AUTH_SECRET`, `AUTH_WEBHOOK_SECRET`, `DJANGO_SECRET_KEY`,
`CRON_SECRET`, `FIELD_ENC_KEY`, `FALLBACK_ENCRYPTION_KEY`,
`PII_KEY`, `DATABASE_URL`, `AZURE_AD_CLIENT_SECRET`,
`OPENAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`.

### Container Apps secrets (names only)

`upstash-redis-rest-token`, `enc-key`, `stripe-webhook-secret`,
`django-secret`, `fallback-encryption-key`, `openai-key`,
`resend-key`, `db-password`, `auth-webhook-secret`,
`azure-ad-client-secret`, `database-url`, `cron-secret`,
`stripe-key`, `auth-secret`, `upstash-redis-rest-url`,
`pii-key`.

### Findings — pilot

| ID | Severity | Finding |
|----|---------:|---------|
| P-01 | CRITICAL | Pilot image is identical to staging (`sha256:838149…c6658`), built from base commit `c77f0cf091…` — **the Wave 0 remediation code is not deployed to pilot**. The `RUNTIME_FAIL_CLOSED=true` flag is honored by legacy code paths but does NOT include the new boot-time demo guard or operational probes. |
| P-02 | HIGH | `UE_FEATURE_PROFILE=executive`. Confirm the executive profile does not import any file under `apps/union-eyes/lib/demo/**` (R-3 register — 35 remaining errors in dashboard pages). Until R-3 is 0, an executive user reaching a demo-tree dashboard page could exercise fixture data. |
| P-03 | HIGH | `TARGET_ENVIRONMENT` is not set. Under the new guard (when deployed), the pilot deployment MUST set `TARGET_ENVIRONMENT=pilot` (a production-tier value) so the guard refuses if `NEXT_PUBLIC_UE_DEMO_PROFILE` or `UE_FEATURE_PROFILE` ever regresses to a demo value. |
| P-04 | HIGH | The following operational-probe capabilities remain `unknown` on pilot because no runtime evidence has been collected against this revision: `queue.worker.heartbeat`, `queue.depth`, `cron.freshness`, `email.delivery`, `sms.delivery`, `clamav.scan`, `storage.artifact`, `payment.processor`, `sentry.reporting`, `synthetic.monitoring`, `audit.seal`, `backup.freshness`, `restore.proof`, `capability.registry.consistency`, `deployment.revision`, `django.sidecar`, `redis.ping`, `tenant.isolation`, `migrations.applied`. |
| P-05 | MEDIUM | `PLATFORM_ADMIN_USER_IDS` still uses Clerk-shaped IDs on pilot too — same disposition as S-03. |
| P-06 | MEDIUM | `SECRET_AUTHORITY=nzila-canada-pilot-kv` claims a Pilot Key Vault as the authority, but 5 secrets in the Container Apps secret store are inline (not KV-references). Confirm these inline secrets are ROTATED from the pilot KV and not from staging. |
| P-07 | INFO | `HEALTH_REQUIRE_QUEUE=true` and `READY_REQUIRE_QUEUE=true` — pilot correctly requires the queue for readiness. |

## Cross-environment findings

| ID | Severity | Finding |
|----|---------:|---------|
| X-01 | CRITICAL | Identical image digest across staging and pilot means the two environments cannot diverge on code. Any Wave 0 rollout MUST use different digests, or MUST include a `git rev-parse` gate that refuses to promote an untested build. |
| X-02 | HIGH | Neither environment has been given `TARGET_ENVIRONMENT`. This is REQUIRED by the new boot-time guard. Wave 0 rollout task: add the env var to both apps BEFORE deploying an image that contains `instrumentation.ts`. |
| X-03 | MEDIUM | `UE_MARKETING_URL` and `UE_APP_URL` point to different hosts on staging but to the same host on pilot. If two-site separation is a policy for pilot, `UE_APP_URL` must be distinct. |
| X-04 | INFO | Neither app exposes a demo-profile env var (`NEXT_PUBLIC_UE_DEMO_PROFILE`). |

## What this attestation DOES NOT prove

- It does NOT prove that Wave 0 remediation runs anywhere. It
  proves the OPPOSITE: neither staging nor pilot currently runs
  the branch code. Any deploy of `fix/union-eyes-reality-remediation`
  MUST be captured in a subsequent attestation `19_STAGING_ATTESTATION.md`.
- It does NOT prove tenant isolation. `ENVIRONMENT_ISOLATION=full`
  is a self-assertion string, not an isolation proof. See
  §10 `tenant.isolation` capability.
- It does NOT prove that any of the secret NAMES map to correct
  KV secrets. Only the KV owner can vouch for content.
- It does NOT prove the pilot Postgres has the schema the branch
  code assumes. Migration parity is a §10 task.

## Follow-up gates before deploying Wave 0 code to staging

1. Set `TARGET_ENVIRONMENT=staging` on `nzila-os-union-eyes-staging`.
2. Set `TARGET_ENVIRONMENT=pilot` on `nzila-os-union-eyes-pilot`.
3. Verify Entra SSO variables on staging (per S-01) or accept
   documented downgrade to email+password.
4. Deploy an image built from a fix branch commit AFTER R-3 has
   been driven to 0 (the demo-tree import ban).
5. Capture a fresh attestation `19_STAGING_ATTESTATION.md` with the
   new image digest and re-hit the `/api/admin/pilot-status` endpoint
   to record the operational-probe outputs from a real revision.
