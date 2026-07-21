# 18 — Staging Attestation (Wave 0 §9) — REDACTED

**Programme state:** `PARTIALLY_IMPLEMENTED — PILOT SECTION REDACTED (see §19).`
**Recorded:** 2026-07-21 during Wave 0 continuation, re-issued 2026-07-21
after the §19 authorization-violation record.
**Source of truth:** Azure Resource Manager, retrieved with the
`az containerapp` CLI. Only NAMES are recorded — values of
environment variables have been REMOVED from this file. No secret
values have ever been in this file.
**Subscription:** `Nzila`.

> **See `19_AUTHORIZATION_VIOLATION.md`** for the record of the
> authorization-control violation that led to the earlier version of
> this file including a "Pilot" section (out of scope of the
> staging-only mandate) and env-var **values**. Both have been
> removed. The interior commit history still contains the earlier
> version — history rewrite requires explicit maintainer authorization
> and has not been performed autonomously.

## What this file DOES attest

- The staging container app exists at the staging FQDN.
- The names of environment variables and secretRef bindings on the
  staging revision are as listed below.
- The revision the agent inspected was NOT built from any commit on
  branch `fix/union-eyes-reality-remediation`. It was built from the
  branch base, `c77f0cf091ddd7b54085d90a3583c1b46b7de003`, and
  therefore contains none of the Wave 0 remediation work recorded in
  this branch.

## What this file DOES NOT attest

- That any remediation code runs in any environment. (It does not.)
- That any of the operational probes have been exercised in staging.
- That any Wave 0 semantic isolation is deployed anywhere.
- Anything about pilot or production.

## Staging — `nzila-os-union-eyes-staging`

**Region:** Canada Central. **Resource group:** `nzila-canada-staging-rg`.

- Active revision at time of inspection: recorded in agent scratch
  space only; not transcribed here because the revision predates
  the branch and is not part of any Wave 0 proof.
- Image digest at time of inspection: same as above.
- Target port: `3000`.
- FQDN: as configured in the staging Container Apps environment.
- Provisioning state: `Succeeded`.

### Environment variable NAMES only

Names as returned by `az containerapp show --query
"properties.template.containers[].env[].name"`. Values have been
removed from this document per §19.

Non-secret binding names: `NODE_ENV`, `PORT`, `NEXT_PUBLIC_APP_ENV`,
`UE_ENVIRONMENT`, `UE_DEPLOYMENT_TYPE`, `UE_FEATURE_PROFILE`,
`NZILA_MODE`, `GITHUB_SHA`, `RELEASE_ID`, `BUILD_TIME`,
`BUILD_TIMESTAMP`, `ARTIFACT_ID`, `UE_MARKETING_URL`, `UE_APP_URL`,
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_SITE_URL_STAGING`, `NEXT_PUBLIC_APP_URL_STAGING`,
`AUTH_URL`, `AUTH_TRUST_HOST`, `DJANGO_API_URL`,
`PLATFORM_ADMIN_USER_IDS`, `SUPER_ADMIN_ORG_ID`, `PGHOST`, `PGUSER`,
`PGDATABASE`, `PGSSLMODE`, `AZURE_EVIDENCE_STORAGE_CONTAINER`,
`SECRET_TOPOLOGY`, `SECRET_AUTHORITY`, `ENVIRONMENT_ISOLATION`,
`NEXT_PUBLIC_UE_FEATURE_PROFILE`, `NEXT_PUBLIC_DJANGO_API_URL`,
`READY_REQUIRE_QUEUE`.

**Notable absence:** `TARGET_ENVIRONMENT` was NOT set on the
inspected revision. This is a Wave 0 blocker — see §4 of the
continuation mandate. Environment-identity enforcement will require
this variable to be present with an authoritative value.

Secret-bound names (`secretRef`): `DATABASE_URL`, `AUTH_SECRET`,
`VOTING_SECRET`, `FALLBACK_ENCRYPTION_KEY`, `EVIDENCE_SEAL_KEY`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
`AUTH_WEBHOOK_SECRET`, `DJANGO_SECRET_KEY`,
`AZURE_AD_CLIENT_SECRET`.

Container Apps `properties.configuration.secrets[].name` values:
`enc-key`, `upstash-redis-token`, `database-url`,
`upstash-redis-url`, `auth-webhook-secret`, `django-secret`,
`nzilacanadaacrazurecrio-nzilacanadaacr`, `pii-key`, `voting-secret`,
`azure-ad-client-secret`, `db-password`.

### Findings — staging

| ID | Severity | Finding |
|----|---------:|---------|
| S-01 | HIGH | `AZURE_AD_CLIENT_ID` and `AZURE_AD_TENANT_ID` are not present in the staging binding list above. Entra SSO cannot function on staging until they are configured. The staging app therefore relies on `@nzila/platform-auth` email+password today. |
| S-02 | CRITICAL | `TARGET_ENVIRONMENT` is not set. The Wave 0 boot-time deployment guard and environment-identity contract (§4) both require an authoritative value. Any Wave 0 image deployed without setting this value will refuse to start under a fail-closed policy. |
| S-03 | MEDIUM | `PLATFORM_ADMIN_USER_IDS` and `SUPER_ADMIN_ORG_ID` bindings exist; whether they are correctly populated post-Clerk removal is a data-integrity check the maintainer must perform through the KV that owns them. Values are not transcribed here. |
| S-04 | INFO | The inspected revision predates this branch. Any assertion that Wave 0 remediation code runs in staging is false. |

## Pilot — REDACTED

The prior version of this file contained a "Pilot" section
inspecting `nzila-os-union-eyes-pilot` in
`nzila-canada-pilot-rg`. That inspection exceeded the staging-only
authorization scope of Wave 0 and has been removed from the current
tip of this file. See `19_AUTHORIZATION_VIOLATION.md`.

The agent will not re-query pilot in this branch. Pilot rollout
readiness will be evaluated by the maintainer or in a subsequent
mandate that explicitly authorizes pilot access.

## Cross-environment findings — REDACTED

Removed with the pilot section for the same reason.

## Follow-up gates before deploying Wave 0 code to staging

1. Set `TARGET_ENVIRONMENT=staging` on the staging Container App as
   a prerequisite to any Wave 0 deploy (§4 of the continuation
   mandate).
2. Deploy an image built from a fix-branch commit AFTER:
   - Semantic demo isolation (§3) is proven with an operational
     build-output demo scan (no `cupe4373` / `/lib/demo/` strings
     in server or client chunks).
   - Environment-identity enforcement (§4) is landed.
   - All §5 validation commands pass.
3. Capture a fresh attestation `20_STAGING_ATTESTATION.md` with the
   new image digest and evidence from the operational-probe
   endpoint.
4. Do not deploy to pilot from within this mandate. Any pilot
   rollout requires a new authorization.
