# Union Eyes CUPE Go-Live Decision

## Decision

GO WITH RESTRICTIONS.

## Scope Of Approval

Approved only for a controlled first live deployment with steward-assisted operations, one pilot organization, curated users, and the legacy member intake and upload path disabled or hidden.

## Engineering Status Update

As of 2026-04-19, the code-level blockers called out below have been addressed in the active pilot path:

1. Member intake now posts to `/api/cases/intake`.
2. Case attachments now flow through `/api/cases/[caseId]/evidence` with POST and DELETE support.
3. Org-scoped API auth now resolves organization context via `getOrganizationIdForUser(userId)` rather than `auth().orgId`.
4. Source-audit coverage was updated and authenticated Playwright pilot-journey coverage was added for submit, assign, transition, audit, and export routes.
5. `apps/union-eyes/infra/main.bicep` now uses a secure PostgreSQL password parameter and no longer emits a password-bearing connection string.

## Why Not Full GO

1. The member new-claim UI still posts to `/api/claims`, while the hardened intake route is `/api/cases/intake`.
2. The same UI and shared upload component still send attachments to `/api/upload`, which is the CMS media CRUD route, not a case evidence route.
3. Organization authorization is not consistent across the codebase. `validateOrganizationAccess()` is permissive, and `requireApiAuth({ orgScoped: true })` still derives org scope from `auth().orgId`.
4. Authenticated end-to-end coverage does not yet prove the critical pilot journey.
5. The deployment template still needs secret-handling hardening.

## Why Not Full No-Go

1. The newer case APIs are materially stronger and support real pilot operations.
2. Assignment, notes, transition, audit, escalation, and evidence export are credible.
3. Document governance and defensibility work are strong enough to justify a restricted paid pilot.

## Mandatory Restrictions

1. Single pilot local only.
2. Steward-assisted intake only until rewiring is complete.
3. Member attachment uploads disabled unless routed through a dedicated case evidence endpoint.
4. Curated role assignment and org membership.
5. Daily pilot review during early live use.

## Mandatory Fixes Before Expansion

1. Rewire member intake to `/api/cases/intake`. Status: Resolved 2026-04-19.
2. Implement dedicated case evidence upload/delete APIs. Status: Resolved 2026-04-19.
3. Remove permissive org access checks and eliminate `auth().orgId` from org-scoped authorization. Status: Resolved 2026-04-19.
4. Add authenticated end-to-end tests for submit, assign, transition, audit, and export. Status: Resolved in code 2026-04-19; operational rehearsal still required.
5. Harden Bicep secret handling for PostgreSQL and runtime app settings. Status: Resolved 2026-04-19.

## Sign-Off Conditions

1. Product confirms restricted pilot scope in writing.
2. Engineering demonstrates the approved route allowlist.
3. Operations completes one end-to-end rehearsal case.
4. CUPE pilot sponsor accepts the phase-one limitations.