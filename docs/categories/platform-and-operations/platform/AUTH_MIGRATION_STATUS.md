# Auth Migration Status: Clerk → @nzila/platform-auth

> Last updated: 2026-04-13

## Summary

All 17 apps have been migrated from Clerk to `@nzila/platform-auth`. The new stack provides:

- **Email/password** authentication (Argon2id hashing, PG-backed sessions) — DEFAULT
- **Microsoft Entra SSO** (via NextAuth.js) — OPTIONAL

## Migration Status

| App | Auth Provider | Notes |
|-----|---------------|-------|
| console | platform-auth | Email/password + Entra SSO |
| partners | platform-auth | Email/password + Entra SSO |
| union-eyes | platform-auth | Next.js + Django (JWT validation via JWKS) |
| abr | platform-auth | Next.js + Django backend |
| flow | platform-auth | |
| agrimo | platform-auth | |
| cfo | platform-auth | |
| cora | platform-auth | |
| trade | platform-auth | |
| mobility | platform-auth | |
| mobility-client-portal | platform-auth | |
| nacp-exams | platform-auth | |
| platform-admin | platform-auth | |
| control-plane | platform-auth | |
| zonga | platform-auth | |
| web | platform-auth | Public site, minimal auth surface |
| orchestrator-api | API key auth | Exception: no session auth (see governance/exceptions/) |

## Remaining Legacy References

### Category A — Active Runtime (backward-compat aliases)

These are **intentionally kept** as backward-compatibility aliases in `@nzila/platform-auth`. They are NOT stale — they ensure a smooth migration path for any external consumers.

| Item | Location | Status |
|------|----------|--------|
| `clerkMiddleware` export alias | `packages/platform-auth/src/entra/server.ts` | Alias → `authMiddleware`. Safe to remove post-GA. |
| `ClerkAPIKeyAuthentication` alias | Django auth classes | Alias → `APIKeyAuthentication`. Safe to remove post-GA. |
| `actorClerkUserId` field | `apps/console` audit log | DB column name preserved for audit continuity |

### Category B — Database/API Compatibility (DO NOT REMOVE)

These are database column names and API fields that must persist for data continuity. Renaming them would break existing data and require a data migration.

| Item | Location | Rationale |
|------|----------|-----------|
| `clerk_org_id` column | Multiple DB tables | Maps to app org; data migration required to rename |
| `clerk_user_id` column | Multiple DB tables | Maps to user ID; data migration required to rename |
| `actorClerkUserId` column | `audit_events` table | Audit trail integrity — never modify historical records |
| `clerkOrgId` serializer field | Django REST serializers | API backward compatibility for existing consumers |

### Category C — Stale References (CLEANED UP)

All stale Clerk references in documentation, tooling, and runbooks were updated in this consistency pass:

- `docs/ga/GA_READINESS_GATE.md` — `clerkMiddleware` → `authMiddleware`
- `docs/platform/GA_READINESS.md` — same
- `docs/stress-test/ENTERPRISE_STRESS_TEST.md` — 8 references updated
- `ops/runbooks/ue-pilot.md` — Clerk dashboard → platform-auth admin
- `ops/runbooks/security/key-rotation.md` — `CLERK_SECRET_KEY` → `AUTH_SECRET`
- `ops/runbooks/security/keyvault-rotation.md` — Clerk signing keys → auth signing keys
- `ops/runbooks/security/README.md` — Clerk users → platform-auth users
- `tooling/openapi-gen/src/generator.ts` — `clerk` security scheme → `platformAuth`

### Scripts to Archive (post-GA)

These scripts referenced Clerk provisioning and have been archived/deleted:

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/zonga-clerk-seed.sql` | Seed Clerk orgs for Zonga | **Deleted** |
| `scripts/zonga-clerk-provision.mjs` | Provision Clerk resources | **Deleted** |
| `scripts/provision-all-test-users.mjs` | Provision test users via Clerk | Superseded by `seed-test-auth-accounts.mjs` |
| `scripts/clerk-provision-pilot-orgs.mjs` | Provision pilot organizations | **Deleted** |
| `tooling/staging-certification/clerk-pilot-orgs.cert.ts` | Pilot org certification | Archive after GA |

## Entra ID Configuration

| Property | Value |
|----------|-------|
| App Registration | "Nzila OS Platform Auth" |
| Client ID | `b7b0cb9a-110d-4bf4-baa7-d936d7450181` |
| Tenant ID | `5082b8be-b04d-4a13-b61c-b6397670177b` |
| Client secret expiry | ~April 2028 (2-year) |
| Redirect URIs | `localhost:3000-3004` + staging domain |

## Environment Variables

All apps use the following auth-related env vars:

```
AUTH_SECRET=          # Session encryption key (required)
AZURE_AD_CLIENT_ID=   # Entra app client ID (optional, for SSO)
AZURE_AD_CLIENT_SECRET= # Entra app client secret (optional, for SSO)
AZURE_AD_TENANT_ID=   # Entra tenant ID (optional, for SSO)
```
