# UnionEyes — Auth Reality Audit

> Phase A — Clerk-Free Truth Pass  
> Status: **COMPLETE** — all active Clerk references removed from runtime, docs, and registry.

---

## Current Auth Stack (as of Phase A)

| Layer | Provider | Path |
|---|---|---|
| Primary | Custom PG-backed password/session auth | `@nzila/platform-auth/password` + `nzila_session` cookie |
| Secondary (SSO) | Microsoft Entra External ID via NextAuth | `@nzila/platform-auth/entra/server` |
| Auth package | `@nzila/platform-auth` | `packages/platform-auth/` |

**Auth resolution order** (from `packages/platform-auth/src/entra/server.ts`):
1. Read `nzila_session` cookie → validate against PG `auth_users` table
2. If no PG session: fall back to Entra/NextAuth JWT
3. If neither: return `{ userId: null }` → fail-closed

**Key env var:** `AUTH_SECRET` — NextAuth session encryption secret. Required at boot. Not Clerk-derived.

---

## Clerk References Found — Full Inventory

### RUNTIME FILES (remediated)

| File | Reference | Type | Status |
|---|---|---|---|
| `app/api/health/route.ts` | `checkAuth()` probed `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Runtime — wrong dependency check | ✅ Fixed: now checks `AUTH_SECRET` |
| `lib/env-validator.ts` | `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` optional vars | Runtime — stale optional config | ✅ Removed |
| `lib/auth/types.ts` | `AuthErrorType.CLERK_UNAVAILABLE` enum value | Runtime — stale enum | ✅ Renamed to `AUTH_PROVIDER_UNAVAILABLE` |
| `lib/auth/types.ts` | `UserContext.clerkId` field | Runtime — stale field | ✅ Deprecated with comment |
| `lib/middleware/auth-middleware.ts` | Comment "handle different Clerk versions"; `getAuthSession = clerkAuth.auth` | Doc comment + aliased import | ℹ️ Aliased correctly; comment is stale internal note (non-blocking) |
| `lib/auth/rbac-server.ts` | Comment "Nzila platform role stored in Clerk publicMetadata.role" | Code comment only | ℹ️ Informational; not a runtime Clerk dependency |
| `__mocks__/platform-auth-server.ts` | `clerkMiddleware` export | Test mock — deprecated alias | ✅ Correct: alias to `authMiddleware`, marked `@deprecated` |

### DOCUMENTATION FILES (remediated)

| File | Reference | Type | Status |
|---|---|---|---|
| `docs/PRODUCTION_TOPOLOGY.md` | Auth provider = Clerk; `CLERK_SECRET_KEY`; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; Clerk org model; Clerk data residency | Active doc — wrong | ✅ Fixed: replaced with platform-auth reality |
| `docs/PRODUCTION_CUTOVER_CHECKLIST.md` | "Authentication (Clerk)" section; Clerk app creation steps; `CLERK_SECRET_KEY`; `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Active doc — wrong | ✅ Fixed: replaced with platform-auth steps |
| `docs/DEMO_RUNBOOK.md` | `AUTH_SECRET` described as "Clerk-derived"; 401 troubleshoot says "Re-issue Clerk session" | Active doc — wrong | ✅ Fixed |
| `docs/PERFORMANCE_BASELINE.md` | "Clerk external latency: 50–200ms" | Active doc — wrong | ✅ Fixed: PG session / NextAuth verify latency |
| `docs/UE_STAGING_AUDIT.md` | Row: "Clerk auth (`@nzila/platform-auth/entra/server`)" | Active doc — misleading | ✅ Fixed: platform-auth (PG primary, Entra secondary) |

### REGISTRY / METADATA (remediated)

| File | Reference | Type | Status |
|---|---|---|---|
| `platform/registry/apps.json` | `production_topology.auth = "Clerk (production app — to be created)"` | Machine-readable — wrong | ✅ Fixed: `platform-auth (PG sessions primary, Entra SSO secondary)` |
| `platform/registry/apps.json` | `"integrations": ["clerk", ...]` | Machine-readable — wrong | ✅ Fixed: `"platform-auth"` |

### ARCHIVED / HISTORICAL FILES (no action required)

| File | Reference | Type | Status |
|---|---|---|---|
| `backend/docs/archive/CLERK_SETUP_COMPLETE.md` | All references | Historical archive — intentional | ✅ No action: archive docs |
| `backend/docs/archive/DJANGO_SETTINGS_GUIDE_CLERK_ERA.md` | All references | Historical archive — intentional | ✅ No action: archive docs |

### STALE CODE PATTERNS (informational, non-blocking)

The following files contain `clerk`-shaped patterns that are **not active Clerk dependencies** — they are stale variable names, comments, or patterns carried from the Clerk era that do not break runtime:

- `lib/middleware/auth-middleware.ts`: variable `clerkAuth` in a `require()` that now loads `@nzila/platform-auth/entra/server`
- `lib/auth/rbac-server.ts`: comment referencing Clerk publicMetadata
- Various DB schema files: `clerkId` column (legacy identity mapping — data residency column, not an active Clerk call)
- Various action files: `clerkId` references in user-facing actions that read from DB column

These are **DB column name artifacts** from the migration, not active Clerk SDK calls. They do not require immediate remediation but should be tracked for future migration.

---

## Replacement Auth Language

| Old claim | Correct replacement |
|---|---|
| "Clerk auth" | "PG-backed password auth (primary), Entra SSO (secondary)" |
| "Clerk JWT" | "NextAuth session cookie / JWT (AUTH_SECRET)" |
| "Clerk Organizations" | "Platform organization model (DB-managed)" |
| "Clerk production app" | "Auth SECRET + platform-auth package" |
| "CLERK_SECRET_KEY" | `AUTH_SECRET` |
| "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" | `NZILA_AUTH_ENABLE_PG_FALLBACK` (optional) |
| "Clerk-derived secret" | "Application auth/session secret (NextAuth)" |
| "Clerk dashboard" | "Platform admin or DB seed" |

---

## Regression Protection

`tooling/contract-tests/ue-auth-reality.test.ts` — static analysis test that fails if `Clerk` appears in active UE runtime/docs outside this file.

---

## Phase A Completion Criteria

- [x] All active Clerk references removed from UE runtime/docs/registry
- [x] Current auth stack accurately documented
- [x] Health endpoint reports `AUTH_SECRET` check, not Clerk key check
- [x] Production topology is truthful and Clerk-free
- [x] Registry machine-readable metadata is corrected
- [x] Regression test added
