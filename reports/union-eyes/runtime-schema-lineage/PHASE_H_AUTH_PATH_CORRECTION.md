# Phase H Auth Path Correction — Union Eyes (nzila-os)

Generated: 2026-09-23T20:04:21Z (UTC) · America/Toronto (ET)
Worktree: `C:\APPS\nzila-ue-runtime-schema-lineage` @ `72c112519`
PRODUCTION_TOUCHED: false · No PR merge · No schema redesign

## User correction honored

Phase H previously framed **NORMAL_AUTHENTICATION=NOT_RUN** as if **Entra/Azure AD** were the pilot login blocker.
**Correction:** Entra is **only a backup** SaaS user authentication method. Infra OIDC (GitHub Actions OIDC → Azure RBAC for deploy/snapshot publish) is a **separate** concern and must not be conflated with SaaS user login.

## 1. Actual primary user-login mechanism

| Field | Value |
|---|---|
| **Name** | **PG-backed password/session auth** (`@nzila/platform-auth/password` + HTTP-only cookie `nzila_session`) |
| **Confidence** | **CODE_CONFIRMED** (+ **DOCUMENTED**) |
| **Alternate primary-family method** | Magic-link email OTP (`/api/auth/magic-link/*`) — also issues `nzila_session` (same session store); LoginForm default mode is `password` |
| **Backup SSO** | Microsoft Entra External ID via NextAuth (`/api/auth/signin/azure-ad`) |
| **Not primary** | Clerk (removed; AUTH_REALITY_AUDIT Phase A COMPLETE) |
| **Not user login** | GitHub OIDC → Azure RBAC (INFRA_OIDC / snapshot & deploy) |

### Evidence citations (short quotes)

**AUTH_REALITY_AUDIT.md** (`apps/union-eyes/docs/security/AUTH_REALITY_AUDIT.md`):
> Primary | Custom PG-backed password/session auth | `@nzila/platform-auth/password` + `nzila_session` cookie
> Secondary (SSO) | Microsoft Entra External ID via NextAuth | `@nzila/platform-auth/entra/server`

**PRODUCTION_TOPOLOGY.md** (`apps/union-eyes/docs/operations/PRODUCTION_TOPOLOGY.md`):
> Provider | `@nzila/platform-auth` — custom PG-backed password/session (primary), Entra External ID / NextAuth (secondary)
> Auth strategy | PG session cookie (`nzila_session`) → Entra / NextAuth JWT fallback

**auth() resolution** (`packages/platform-auth/src/entra/server.ts`):
> Resolution order:
>   1. PG session cookie (`nzila_session`) — email/password auth
>   2. Entra / NextAuth JWT — SSO
Plus step 0: staging acceptance header/cookie (`x-unioneyes-acceptance-auth` / `ue_acceptance_auth`) — identity-only.

**Login UI** (`apps/union-eyes/components/auth/login-form.tsx`):
> `const [mode, setMode] = useState<Mode>('password');`
> `fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })`
> SSO backup: `window.location.href = `/api/auth/signin/azure-ad?callbackUrl=${cb}`;`

**Login API** (`apps/union-eyes/app/api/auth/login/route.ts`):
> `export { handleLogin as POST } from '@nzila/platform-auth/password/handlers'`

**Session cookie** (`packages/platform-auth/src/password/session.ts`):
> `export const SESSION_COOKIE_NAME = 'nzila_session'`

## 2. Auth path map (primary → DB)

```
PRIMARY LOGIN
  LoginForm (mode=password) 
    → POST /api/auth/login 
    → handleLogin → login() [password/auth-service]
    → verifyPassword + createSession
    → setSessionCookie(nzila_session)

(optional) MAGIC-LINK (same session family)
  → /api/auth/magic-link/request|verify → nzila_session

(backup) ENTRA SSO
  → /api/auth/signin/azure-ad → NextAuth JWT (only if no PG session)

IDENTITY RESOLUTION (request time)
  auth() [packages/platform-auth/src/entra/server.ts]
    0. acceptance JWT (staging) OR
    1. nzila_session → getAuthUser (PG auth_users/sessions) OR
    2. Entra/NextAuth JWT
  → canonical userId (+ optional orgId from session/acceptance)

ORGANIZATION RESOLUTION
  getOrganizationIdForUser(userId) [apps/union-eyes/lib/organization-utils.ts]
    selected_org_id cookie → membership check → org fallbacks
  also used from api-auth-guard / with-api

ROLES / GRANTS
  organizationMembers.role (DB) via api-auth-guard getUserContext / requireRole*
  platform-admin override via PLATFORM_ADMIN_USER_IDS
  matter/document grants + RepresentationAuthority (downstream of identity)

RLS → DATABASE
  withRLSContext [apps/union-eyes/lib/db/with-rls-context.ts]
    → await auth()
    → set_config('app.current_user_id', userId, true)
    → set_config('app.current_org_id', orgId, true)
    → tenant-scoped queries under RLS
```

## 3. Four-way separation (do not conflate)

| Lane | Mechanism | Role | Status (this correction) |
|---|---|---|---|
| **PRIMARY_AUTHENTICATION** | PG password/session (`nzila_session`); magic-link same cookie family | SaaS user login | **NOT_YET_PROVEN** (code-path mapped; no interactive staging login with real primary credentials) |
| **BACKUP_ENTRA_AUTHENTICATION** | Entra External ID / NextAuth azure-ad | Backup SSO only | **NOT_YET_PROVEN** |
| **ACCEPTANCE_AUTH** | `x-unioneyes-acceptance-auth` / `ue_acceptance_auth` | Staging/test identity-only fixture | **PASS** (Phase G HTTP matrix) |
| **INFRA_OIDC** | GitHub Actions OIDC → Azure RBAC (deploy / snapshot storage) | Deployment & snapshot publish — **not** SaaS login | **PARTIAL_PASS** (canonical snapshot RBAC+PUBLISH PASS; workflows use OIDC login) |

## 4. Pilot blocker reframing

| Before (wrong framing) | After (corrected) |
|---|---|
| Pilot blocked because Entra / NORMAL_AUTHENTICATION NOT_RUN (Entra-shaped) | **PILOT_BLOCKER = PRIMARY_AUTHENTICATION_NOT_PROVEN** (PG password/session path) |
| Entra treated as normal auth | Entra = **BACKUP_ENTRA_AUTHENTICATION** only |
| Infra OIDC mixed into user auth story | **INFRA_OIDC** kept separate; partially proven for snapshot/deploy |

**CONTROLLED_PILOT_READINESS = BLOCKED** until:
1. PRIMARY_AUTHENTICATION proven end-to-end on staging (password → session → org → role → withRLSContext → authorized API), **and**
2. Existing non-auth pilot blockers remain: EXTERNAL_SPECIALIST_BOUNDARY PARTIAL, EXPIRED_WAIVERS, DEPENDENCY_VULNERABILITIES, GOVERNANCE_GATE.

## 5. Honest proof plan (no credentials invented)

Do **not** claim E2E PASS without exercising staging with a real primary credential.

**Minimum PRIMARY_AUTHENTICATION proof (staging only):**
1. Confirm staging revision still `nzila-os-union-eyes-staging--0000259` lineage.
2. Operator supplies a **staging** PG user email+password (or creates one via documented seed/admin path) — **interactive / user-assisted**.
3. Browser or scripted POST `/api/auth/login` → expect `nzila_session` Set-Cookie.
4. Call authenticated surface (e.g. `/api/auth/me` or org-current) with cookie → assert userId.
5. Call org-scoped API → assert organization resolution + role.
6. Confirm DB session vars via an existing RLS-backed route (or Phase G–style matrix) under the same cookie — **not** acceptance header.
7. Negative: logout / cleared cookie → 401.

**BACKUP_ENTRA proof (optional, non-blocking for primary framing):** one supervised Entra SSO smoke on staging.

**Out of scope here:** inventing passwords, using production, merging PRs, conflating INFRA_OIDC success with user login.

## 6. Files updated by this correction

- `PHASE_H_AUTH_PATH_CORRECTION.md` (this file)
- `PHASE_H_EVIDENCE.json` / `.md` — section B + E + blocked inputs
- `PHASE_H_DISPOSITION.md` — three-way narrative + bars
- `PHASE_H_PARENT_SUMMARY.json` — structured correction fields
