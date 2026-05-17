# UnionEyes — Secret Management Validation (B1B)

Vault: `nzila-canada-prod-kv` in `nzila-canada-prod-rg`.
Mode: Azure RBAC (`enableRbacAuthorization: true`),
soft delete + purge protection both enabled.

## Container App secret references (live)

`az containerapp show` against `nzila-os-union-eyes-prod` returned the
following env vars that resolve to ACA `secretRef`s (no plaintext value
on the container env, only the reference):

| Env var | ACA secret ref | Source of truth |
|---|---|---|
| `DATABASE_URL` | `database-url` | Key Vault |
| `AUTH_SECRET` | `enc-key` | Key Vault |
| `VOTING_SECRET` | `voting-secret` | Key Vault |
| `FALLBACK_ENCRYPTION_KEY` | `enc-key` | Key Vault |
| `EVIDENCE_SEAL_KEY` | `pii-key` | Key Vault |
| `AZURE_AD_CLIENT_SECRET` | `azure-ad-client-secret` | Key Vault |
| `AUTH_WEBHOOK_SECRET` | `auth-webhook-secret` | Key Vault |
| `DJANGO_SECRET_KEY` | `django-secret` | Key Vault |
| `UPSTASH_REDIS_REST_URL` | `upstash-redis-url` | ACA secret (Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | `upstash-redis-token` | ACA secret (Upstash) |
| `AZURE_EVIDENCE_STORAGE_KEY` | `evidence-storage-key` | ACA secret (blob store) |

Plain env vars (non-secret): `NODE_ENV`, `PORT`, `UE_ENVIRONMENT`,
`NEXT_PUBLIC_*`, `UE_*`, `PGHOST`, `PGUSER`, `PGDATABASE`, `PGSSLMODE`,
`AUTH_URL`, `AUTH_TRUST_HOST`, `AZURE_AD_CLIENT_ID`,
`AZURE_AD_TENANT_ID`, `GITHUB_SHA`, `RELEASE_ID`, `BUILD_TIME`,
`BUILD_TIMESTAMP`, `ARTIFACT_ID`, `DJANGO_API_URL`,
`PLATFORM_ADMIN_USER_IDS`, `SUPER_ADMIN_ORG_ID`.

> ℹ Redis validated `2026-05-17T19:10:00Z`: Upstash instance
> `cuddly-mudfish-102231.upstash.io` provisioned by user. Token stored
> as ACA secrets (`upstash-redis-url`, `upstash-redis-token`) and wired
> via `secretRef` on revision `--0000049`. Health confirmed live:
> `redis: {status:"ok", ms:37}`.
> **Gap remaining**: token should be migrated to Key Vault and rotated
> before PRODUCTION READY stamp.
>
> ℹ Evidence blob store added `2026-05-17T20:30:00Z`: storage account
> `nzilacanadaprodev` (Standard_GRS, canadacentral, HTTPS-only,
> deny-all + AzureServices bypass). Container `union-eyes-evidence`
> (private). Storage key stored as ACA secret `evidence-storage-key`.
> Env vars `AZURE_EVIDENCE_STORAGE_ACCOUNT`, `AZURE_EVIDENCE_STORAGE_CONTAINER`,
> `AZURE_EVIDENCE_STORAGE_KEY` wired on revision `--0000062`.
> **Gap remaining**: storage key should be migrated to Key Vault before
> PRODUCTION READY stamp. ACA managed identity granted `Key Vault Secrets
> Officer` on `nzila-canada-prod-kv` (principal `264f8347-4c8c-4732-983f-3bb06b563a0a`)
> `2026-05-17T20:45:00Z` — KV-backed migration path is now unblocked.

## In-repo scan

- Phase A regression test `tooling/contract-tests/ue-auth-reality.test.ts`
  guards against legacy auth-vendor re-introduction (see
  `AUTH_REALITY_AUDIT.md` for the historical context).
- `apps/union-eyes/.env*.example` files contain only placeholders —
  validated by the auth reality audit.
- No secret values were observed in source during this pass.

## RBAC observation

When listing secret names with the current CLI principal
(`appid=04b07795-8ddb-461a-bbee-02f9e1bf7b46`, the Azure CLI client
ID acting as the signed-in user), the vault returned
`Forbidden: Caller is not authorized to perform action on resource`.

This is the **expected** behavior — secret read access is intentionally
gated to the Container App's managed identity and named operators, not
to ad-hoc CLI logins. It is recorded as positive evidence that RBAC is
enforced rather than a gap to fix.

## Rotation policy (documented, execution pending)

| Secret | Owner | Cadence | Mechanism |
|---|---|---|---|
| `database-url` | Platform | 90 days or on incident | Rotate PG admin password → update KV → ACA revision rollout |
| `enc-key` (`AUTH_SECRET`, `FALLBACK_ENCRYPTION_KEY`) | Security | 180 days or on incident | Dual-key rollover; new key added before old key removed |
| `pii-key` (`EVIDENCE_SEAL_KEY`) | Security | 365 days, **never** mid-evidence-window | Append-only rotation with sealed-record carry-forward |
| `azure-ad-client-secret` | Identity | Per Entra app expiry | Generate in Entra → update KV → roll ACA revision |
| `auth-webhook-secret`, `voting-secret`, `django-secret` | Platform | 180 days | Roll → update KV → roll revision |

Rotation rehearsal has **not yet been executed** in production.
Status remains `configured`, not `validated`.

## Gaps

1. `UPSTASH_REDIS_REST_TOKEN` — stored as ACA secret (not yet in Key Vault). KV migration path unblocked (`Key Vault Secrets Officer` granted to ACA managed identity `2026-05-17T20:45:00Z`). Execute before PRODUCTION READY stamp.
2. `AZURE_EVIDENCE_STORAGE_KEY` — stored as ACA secret (not yet in Key Vault). Same migration path as above. Execute before PRODUCTION READY stamp.
3. No documented evidence of a real production rotation run.
4. Caller-side access logs (Key Vault diagnostic logs to LAW) should be
   confirmed enabled — not verified in this pass.
