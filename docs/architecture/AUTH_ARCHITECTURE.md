# Auth Architecture

> Canonical reference for Nzila OS authentication and authorization.

## Auth Package

All apps authenticate via `@nzila/platform-auth` (`packages/platform-auth/`).

## Auth Methods

### 1. Email/Password (Default)

- **Provider:** `@nzila/platform-auth/password`
- **Hashing:** Argon2id (OWASP-recommended: 19 MiB memory, 2 iterations)
- **Sessions:** Opaque tokens (256-bit random → SHA-256) stored in `auth_user_sessions` table
- **Cookie:** `nzila_session` (HTTP-only, Secure, SameSite=Lax)
- **Lockout:** 5 failed attempts → 15-minute lockout
- **Password policy:** 8–128 chars, upper + lower required
- **Password reset:** Rate-limited (3 resets per 15-min window per IP)
- **Audit:** All auth events logged to `auth_audit_log` table

### 2. Microsoft Entra SSO (Optional)

- **Provider:** `@nzila/platform-auth/entra` (NextAuth v5 + `MicrosoftEntraID`)
- **Issuer:** `/common/v2.0` (multi-tenant + personal Microsoft accounts)
- **Scopes:** `openid profile email User.Read`
- **Sessions:** JWT, 24h max age
- **Role mapping:** Entra `groups` claim → `activeOrgId`; `roles` claim → `orgRole`
- **Auto-provisioning:** `onSignInHook` creates platform user on first Entra sign-in

## Resolution Order

`auth()` checks authentication in this order:

1. **PG session cookie** (`nzila_session`) → validate against `auth_user_sessions` → email/password user
2. **NextAuth JWT** → validate Entra token → SSO user
3. **Neither** → `{ userId: null }`

Email/password takes precedence when both sessions exist.

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `AUTH_SECRET` | **Yes** | Session encryption secret |
| `AZURE_AD_CLIENT_ID` | No (for SSO) | Entra app registration client ID |
| `AZURE_AD_CLIENT_SECRET` | No (for SSO) | Entra app registration client secret |
| `AZURE_AD_TENANT_ID` | No (for SSO) | Entra tenant ID |

## RBAC

Roles are resolved from the authenticated session:

| Role | Access Level |
|------|-------------|
| `platform_admin` | Full unrestricted access |
| `studio_admin` | Content, analytics, documentation |
| `ops` | Automation, deployments, monitoring |
| `analyst` | Read-only analytics dashboards |
| `viewer` | Read-only documentation |

For email/password users, roles are stored in the database.
For Entra SSO users, roles are derived from security group membership.

## Package Exports

| Import | Purpose |
|--------|---------|
| `@nzila/platform-auth` | Identity types, authorization guards |
| `@nzila/platform-auth/password` | `signup`, `login`, `logout`, `forgotPassword`, `resetPassword` |
| `@nzila/platform-auth/password/handlers` | Pre-built Next.js API route handlers |
| `@nzila/platform-auth/entra/config` | NextAuth config, `auth`, `signIn`, `signOut` |
| `@nzila/platform-auth/entra/server` | `auth()`, `currentUser()` (Clerk-compat API) |
| `@nzila/platform-auth/entra/client` | `useUser()`, `useAuth()`, `<AuthProvider>` |
| `@nzila/platform-auth/entra/components/*` | `SignIn`, `SignUp`, `UserButton`, `OrgSwitcher` |

## Django Backends (ABR, Union-Eyes)

Django backends validate JWT tokens via JWKS endpoint. The auth classes have backward-compatible aliases (`ClerkAPIKeyAuthentication` = `APIKeyAuthentication`) from the Clerk era.

## Migration History

The platform migrated from Clerk to `@nzila/platform-auth` in early 2026. Legacy Clerk references may exist in:

- CSP headers in `next.config.ts` (non-functional, can be cleaned up)
- Code comments and function names (backward-compat aliases)
- Archived docs under `*/docs/archive/`

See [auth-migration-architecture.md](../platform/auth-migration-architecture.md) for historical migration artifacts.
