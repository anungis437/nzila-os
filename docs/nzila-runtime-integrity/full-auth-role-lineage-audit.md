# Full Auth & Role Lineage Audit

> Authoritative audit of the **runtime identity chain** across Nzila OS. Establishes one canonical, deterministic, fail-closed lineage for resolving `userId → organizationId → role → landing surface` across `dev`, `staging`, `demo`, and `pilot`. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Final Runtime Convergence (Union Eyes)](../union-eyes/runtime-convergence/README.md)
- [Final Gating Philosophy](../union-eyes/navigation-monetization-matrix/final-gating-philosophy.md)

## Posture

The runtime identity chain must be:

- singular
- deterministic
- governance-safe
- continuity-safe
- reviewer-of-record traceable
- evidence-anchored
- explicitly bounded
- institutionally calm under degradation

There must be **exactly one canonical role lineage chain**. No ambiguous duality between platform auth tables and legacy `organization_members` rows.

## Audit Targets

The following runtime resolution surfaces are in scope for the downstream PR. Each must be audited against a single canonical chain — never as a network of overlapping fallbacks.

| Surface | Concern | Required Posture |
| --- | --- | --- |
| `auth()` | session resolution | PG session → Entra fallback (already canonical) |
| `currentUser()` | user identity object | mirror `auth()` resolution order |
| `getUserRole(userId, organizationId)` | role resolution | platform-auth first, `organization_members` only as legacy fallback |
| `getOrganizationIdForUser(userId)` | org resolution | cookie → primary platform-auth membership → fallback |
| organization switching | runtime org context | cookie write must invalidate stale role caches |
| `auth_user_sessions` | session lineage | one-active-session-per-token guarantee |
| `organization_members` | legacy/canonical RBAC | explicitly designated legacy fallback only |
| `auth_organization_users` | platform-auth canonical RBAC | source of truth for platform-auth users |
| seeded personas | E2E + demo identity | must traverse the same chain as production users |
| role redirects | `/dashboard` → role landing | deterministic per `getRoleLandingPath` |
| dashboard landing logic | layout-level routing | governance-safe error surfaces, never silent collapse |
| locale-aware redirects | `/${locale}/dashboard/...` | locale must always be preserved across all redirects |
| auth cookies | `nzila_session`, `selected_org_id`, `active-organization` | each cookie must have a single documented owner |

## Required Outputs (per surface)

For each runtime surface above, the downstream PR must document — in code or in evidence-anchored runtime memos — the following:

1. **source of truth** — which table or claim is canonical
2. **fallback chain** — explicitly enumerated, never implicit
3. **fail-open risk** — currently observed or theoretical
4. **fail-closed behavior** — required posture under failure
5. **schema dependency** — tables and columns the surface reads
6. **runtime dependency** — env vars, cookies, headers required
7. **E2E dependency** — fixtures and seed assumptions

## Cross-Environment Scope

This audit applies across `dev`, `staging`, `demo`, and `pilot`. Any divergence between environments must be either:

- explicitly documented as intentional
- or eliminated by the downstream PR

## Forbidden Posture

The following framings are explicitly rejected and must not appear in the implementation:

- **ai-first** identity inference (forbidden — identity is institutional, not ai-powered guesswork)
- **autonomous executive** auto-elevation (forbidden — every role transition is reviewer-of-record gated)
- **engagement gamification** of auth flows (forbidden — auth is institutional, not a copilot, not a chatbot, not workforce ai, not productivity optimization, and not an ai assistant or ai ceo surface)

## Stewardship Cadence

Audit findings must be reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence and traced to the canonical maturity vocabulary. Embodied posture: identity is **inevitable**, **calm**, and **operational** — never historically accumulated.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-auth-role-lineage-audit`. That PR must not bundle organization convergence, persona hardening, or workspace substrate work — those are authorized separately by their respective documents in this layer.
