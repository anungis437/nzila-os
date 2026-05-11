# Full Organization Identity Convergence

> Eliminates organization identity ambiguity across Nzila OS. Establishes one canonical, deterministic, governance-safe organization resolution chain. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Final Runtime Convergence (Union Eyes)](../union-eyes/runtime-convergence/README.md)

## Posture

Organization identity must be:

- singular per user-session pair
- deterministic
- governance-safe
- continuity-safe
- reviewer-of-record traceable
- evidence-anchored
- explicitly bounded
- institutionally calm

There must **never** be:

- multiple canonical org truths
- silent org fallback to a default organization without explicit, documented intent
- implicit default-org collapse during role resolution
- org ambiguity at the boundary between `auth_organization_users` and `organization_members`

## Convergence Targets

| Surface | Current Risk | Target Posture |
| --- | --- | --- |
| `organization_members` | legacy/canonical RBAC source | designated **legacy fallback only** |
| `auth_organization_users` | platform-auth canonical RBAC | designated **primary source of truth** |
| auth org mappings (`organizationId` on `AuthUser`) | session-scoped org context | must be authoritative for the session lifetime |
| default org (`DEFAULT_ORGANIZATION_ID`) | silent fallback in `getOrganizationIdForUser` | only used after explicit absence of platform-auth and legacy memberships, never as a hidden coercion |
| `selected_org_id` cookie | client-driven org switcher | UUID-based selector (canonical) |
| `selected_organization_id` cookie | mirror of `selected_org_id` | same semantics; converge or document |
| `selected_tenant_id` cookie | legacy alias | document as legacy-only and converge |
| `active-organization` cookie | slug-based selector | secondary, slug-resolved against `organizations.slug` |
| org UUID handling | every server boundary | always UUID at the API/service boundary |
| org slug handling | URL-facing surfaces only | resolved to UUID before any RBAC check |
| org path resolution | `/dashboard/...` and API routes | UUID-derived, never slug-derived at the data layer |
| org runtime context | RSC + client provider | provider must mirror server-resolved org |

## Required Implementation (downstream PR)

The downstream runtime hardening PR (`refactor/nzila-organization-identity-convergence`) must actually:

- explicitly enumerate the org resolution order in `lib/organization-utils.ts` as a single ordered list, not nested cookie/email branches
- collapse `selected_org_id`, `selected_organization_id`, and `selected_tenant_id` to a single canonical cookie name with a documented compatibility shim for legacy cookies
- emit a structured runtime log line each time the resolver falls back to `DEFAULT_ORGANIZATION_ID` so silent org fallback becomes observable evidence
- propagate the resolved org UUID into the dashboard layout context once and only once per request, eliminating duplicate `getOrganizationIdForUser` calls
- ensure all org-scoped redirects preserve locale and the canonical org cookie name

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** organization inference (forbidden — orgs are not ai-powered guesses, not copilot suggestions, not chatbot defaults, not workforce ai groupings)
- **autonomous executive** auto-binding to an org (forbidden — every org assignment is reviewer-of-record traceable)
- silent default-org collapse without an emitted, evidence-anchored log signal (forbidden — silence is incompatible with governance-safe operation)
- **engagement gamification** of org switchers (forbidden — org context is institutional, never a productivity optimization surface, never an ai assistant or ai ceo affordance)

## Stewardship Cadence

Org resolution divergence is reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Each divergence must be either resolved or formally documented as an institutionally accepted exception.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-organization-identity-convergence`. It must not bundle auth lineage, persona hardening, dashboard failure integrity, or workspace substrate work.
