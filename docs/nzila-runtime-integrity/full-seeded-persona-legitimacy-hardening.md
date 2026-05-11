# Full Seeded Persona Legitimacy Hardening

> Ensures seeded test personas behave as **real institutional operators** across `dev`, `staging`, `demo`, and `pilot` environments. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Full Organization Identity Convergence](full-organization-identity-convergence.md)

## Posture

Every seeded test credential must:

- traverse the same canonical identity chain as a production user
- resolve to a single canonical organization
- resolve to a single canonical role
- land on the canonical role landing surface deterministically
- carry institutionally legitimate display data (name, email, title)
- not depend on workarounds, schema-drift catches, or fail-open fallbacks

A seeded persona must **fully embody its institutional role**. A seeded `executive` is operationally an executive. A seeded `steward` is operationally a steward. A seeded `member` is operationally a member. There is no half-state.

## Audit Targets

| Surface | Concern | Required Posture |
| --- | --- | --- |
| `apps/union-eyes/scripts/seed-test-env.ts` | persona seeding | every insert must be against the canonical schema; no try/catch swallowing of schema drift in the success path |
| seed topology | which tables are populated | one canonical persona shape: `auth_users` + `auth_organization_users` + `auth_user_sessions` + `organization_members` (legacy mirror) |
| persona org mappings | `UE_TEST_USERS` → `UE_TEST_ORGS` | each persona has exactly one primary org; org IDs are UUIDs; slugs only used at URL boundaries |
| persona role mappings | `UE_TEST_USERS[*].role` | role strings must be enumerated in the canonical role registry; no implicit defaults |
| session cookies | `nzila_session` for E2E | deterministic per-persona token mapped to a real `auth_user_sessions` row |
| auth bootstrap | `bootstrapE2EAuth` | must verify the seeded persona resolves through `auth()` before any test asserts |
| redirect expectations | `/dashboard` → role landing | every persona has a single expected landing path that matches `getRoleLandingPath(persona.role)` |
| operational permissions | API + UI surfaces | every persona must be able to perform its institutional duties end-to-end without reliance on platform-admin escapes |
| role navigation | sidebar surfaces | every persona must see its required nav surfaces and none of its forbidden nav surfaces |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-seeded-persona-legitimacy-hardening`) must actually:

- reconcile the QA baseline schema (`tooling/sql/union-eyes-qa-baseline.sql`) with the live `organization_members` Drizzle schema so the seed completes without a schema-drift catch path; the existence of the catch is itself a governance-safe stopgap, not a target end state
- remove or convert any `if (isMissingColumnError) console.warn(...)` paths to either fully reconciled inserts or formally documented legacy exceptions
- guarantee that every persona in `UE_TEST_USERS` has matching rows in `auth_users`, `auth_organization_users`, `auth_user_sessions`, and (legacy mirror) `organization_members`
- assert in `bootstrapE2EAuth` that each persona resolves through the canonical chain before tests run; failure to resolve must fail bootstrap loudly rather than silently
- guarantee that the demo environment seed mirrors the E2E seed for the personas exposed to demo viewers, so demo behavior is institutionally truthful

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** persona inference (forbidden — personas are deterministic seeds, not ai-powered guesses, not chatbot characters, not workforce ai avatars)
- **autonomous executive** persona elevation (forbidden — no persona is auto-promoted)
- silent role downgrade on missing fixtures (forbidden — fail-closed, fail loudly)
- **engagement gamification** of persona experience (forbidden — institutional embodiment is not productivity optimization, not an ai assistant or ai ceo simulation, not copilot fan-service)

## Stewardship Cadence

Seeded persona drift is monitored on the standing daily / weekly / monthly / quarterly stewardship cadence. Any persona that loses institutional legitimacy is treated as a continuity-safe runtime regression and remediated under reviewer-of-record approval.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-seeded-persona-legitimacy-hardening`. It must not bundle auth lineage, organization convergence, or workspace substrate work.
