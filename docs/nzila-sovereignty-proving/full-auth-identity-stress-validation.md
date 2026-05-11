# Full Auth & Identity Stress Validation

> **Doctrine.** Identity degradation must be deterministic and understandable.

## Authority

This document stress-tests the institutional identity surface of Nzila OS across dev / staging / demo / pilot. Identity is the foundation of all governance lineage; its degradation must be **explicit, bounded, deterministic, and governance-safe**. The runtime must never silently grant access on a degraded identity path. Continuity-safe, anti-surveillance, evidence-anchored, reviewer-of-record bound.

## 1. Identity surface enumeration

The Nzila OS identity surface comprises:

- `auth()` — the canonical resolver in `@nzila/platform-auth`
- `getOrganizationIdForUser` — app-level org resolver in `organization-utils.ts`
- `auth_user_sessions` — opaque session table (Argon2id, Postgres-backed)
- `organization_members` — role + membership lineage
- `auth_organization_users` — Django-side organization binding
- `nzila_session` — opaque session cookie
- `selected_org_id` — operator-chosen active org cookie
- `default_organization_id` — fallback org binding (per-user)

The dual-auth model is: **email/password (Argon2id + PG sessions) is DEFAULT; Entra SSO is OPTIONAL**. `auth()` resolution order is: PG session cookie first → Entra/NextAuth JWT fallback.

## 2. Stress cells (per-environment)

### 2.1 Expired sessions

| Environment | Probed behavior | Verdict |
|---|---|---|
| dev | session lookup returns null past `expires_at`; redirect 307 → /login | **GO** |
| staging | same | **GO** |
| demo | same; live probe `/en-CA/dashboard` unauthenticated → 307 → /login | **GO** |
| pilot | same; live probe `/en-CA/dashboard` unauthenticated → 307 → /login | **GO** |

### 2.2 Invalid org cookies

| Environment | Probed behavior | Verdict |
|---|---|---|
| dev | invalid `selected_org_id` → resolver falls back to `getOrganizationIdForUser`; if no membership, redirect to onboarding | **GO** |
| staging | same | **GO** |
| demo | same | **GO** |
| pilot | same | **CONDITIONAL GO** — pilot org seeding deferred; full membership lineage probe scoped to chore PR |

### 2.3 Role mismatch

| Environment | Probed behavior | Verdict |
|---|---|---|
| dev | role-gated route returns 403 with explicit copy | **GO** |
| staging | same | **GO** |
| demo | same | **GO** |
| pilot | same | **GO** at the resolver layer |

### 2.4 Partial auth state

If a user has a valid PG session but no `organization_members` row:

- Org-scoped routes redirect to `/onboarding/select-organization`
- The runtime never silently uses `auth().orgId` (the AD group GUID) as a fallback
- The runtime never auto-creates an org

| Environment | Verdict |
|---|---|
| dev / staging / demo / pilot | **GO** at the resolver layer |

### 2.5 Org-switch degradation

Org switching writes `selected_org_id` and re-resolves on next request. Failure modes:

- Switch to an org the user is not a member of → 403, cookie not persisted
- Switch to an org that no longer exists → 404, cookie cleared
- Switch mid-session → next request re-resolves; UI does not cache stale grant

| Environment | Verdict |
|---|---|
| dev / staging / demo / pilot | **GO** at the resolver layer |

### 2.6 Seeded-persona degradation

Seeded personas (used in dev / demo) must:

- Carry the same fail-closed contracts as production users
- Never bypass `getOrganizationIdForUser`
- Never receive an implicit role grant
- Be tagged as `is_seeded=true` in `auth_user_sessions` for telemetry

| Environment | Verdict |
|---|---|
| dev / demo | **GO** |
| staging / pilot | **N/A** — seeded personas not provisioned |

### 2.7 Locale redirect degradation

Live evidence reveals a **bounded** middleware degradation: `/en/X` is double-prefixed to `/en-CA/en/X`.

| Environment | Probed behavior | Verdict |
|---|---|---|
| demo | `/en/dashboard` → 307 → `/en-CA/en/dashboard` (single hop, deterministic) | **CONDITIONAL GO** — bounded but anomalous |
| staging | same | **CONDITIONAL GO** |
| pilot | same | **CONDITIONAL GO** |

The redirect is bounded (not infinite). Tracked under `chore/locale-double-prefix-traversal`.

### 2.8 Auth provider degradation

If Entra SSO is unavailable:

- The PG email/password path remains active (it is the default)
- `auth()` returns the PG session result
- The runtime never silently grants Entra-only roles to PG sessions
- The runtime never silently demotes PG sessions to anonymous

| Environment | Verdict |
|---|---|
| dev / staging / demo / pilot | **GO** at the resolver layer |

## 3. Account lockout

The account lockout policy (5 failed attempts → 15-min lockout) is enforced in `@nzila/platform-auth`. The lockout:

- Is **per-user**, not per-IP (anti-surveillance)
- Emits an explicit "account locked — try again at <ISO>" copy
- Never silently rejects valid credentials
- Auto-clears at the bounded TTL

Verdict: **GO** at the policy layer.

## 4. Session integrity

Sessions are opaque tokens stored in `auth_user_sessions`. Integrity properties:

- Argon2id-hashed at the application boundary
- Bound to `expires_at` (no infinite sessions)
- Revocable per-user (logout invalidates the row)
- Not introspectable from the cookie alone

Verdict: **GO**.

## 5. Anti-pattern enumeration (rejected)

The identity layer forbids:

- silent grant on degraded identity path
- implicit fallback from PG session to Entra without explicit re-auth
- implicit fallback from `getOrganizationIdForUser` to `auth().orgId`
- silent role refresh skip
- silent org refresh skip
- caching role grants beyond the request boundary
- bypassing `auth_user_sessions.expires_at`
- bypassing the lockout policy

These are forbidden across the proving layer.

## 6. Verdict

Identity degradation across dev / staging / demo / pilot is **deterministic, bounded, governance-safe, and reviewer-of-record anchored**. The runtime never silently grants, never silently demotes, never silently caches.

**Aggregate verdict: GO at the resolver layer; CONDITIONAL GO at the pilot membership lineage and locale-redirect layer.**
