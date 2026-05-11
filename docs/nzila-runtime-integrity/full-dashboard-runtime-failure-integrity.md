# Full Dashboard & Runtime Failure Integrity

> Eliminates silent runtime collapse. Establishes governance-safe, continuity-safe, operationally bounded failure behavior across dashboard layouts, route guards, and onboarding flows. Authorizes a separate runtime hardening PR.

## Authority Anchors

- [Runtime Integrity README](README.md)
- [Full Auth & Role Lineage Audit](full-auth-role-lineage-audit.md)
- [Full Organization Identity Convergence](full-organization-identity-convergence.md)

## Posture

The runtime must **never** silently collapse into ambiguity. Every runtime failure must be:

- explicit
- bounded
- governance-safe
- continuity-safe
- operationally understandable
- reviewer-of-record traceable
- evidence-anchored

Runtime failures must increasingly feel **institutionally governed**, not broken. An institutional operator who encounters degradation must immediately understand:

- what failed
- what is still safe to do
- who to contact
- whether the failure is bounded or escalating

## Audit Targets

| Surface | Concern | Required Posture |
| --- | --- | --- |
| `apps/union-eyes/app/[locale]/dashboard/error.tsx` | catches every layout throw and renders a generic error UI **at the same URL the user requested**, masking the absence of the role landing redirect | must distinguish identity-resolution failures (redirect to a governance-safe identity-recovery surface) from genuine application errors |
| dashboard layout (`apps/union-eyes/app/[locale]/dashboard/layout.tsx`) | swallows org-membership sync errors with `logger.warn` and continues | every swallowed error must either be eliminated or surfaced as an explicit, bounded degradation banner |
| auth guards | currently mix `redirect('/login')` and silent fall-through paths | converge on a single, deterministic auth guard primitive |
| route guards | per-route role checks | each route guard must declare its required role, its fail-closed behavior, and its evidence-anchored degradation message |
| onboarding guards | profile auto-create paths | must not silently mask missing institutional context |
| role redirects | `/dashboard` → role landing | a failed redirect must surface a governance-safe identity-recovery view, never a generic “Something went wrong” |
| cognition surfaces | bounded synthesis surfaces | must show a bounded-degradation state when synthesis is unavailable, never a fail-open empty surface |
| governance surfaces | reviewer-of-record gates | must remain visibly gated under degradation, never silently relaxed |

## Required Implementation (downstream PR)

The downstream PR (`refactor/nzila-dashboard-runtime-failure-integrity`) must actually:

- introduce a typed `RuntimeIdentityError` distinguished from generic application errors
- update `dashboard/error.tsx` to detect identity-class errors and render a governance-safe identity-recovery view (with evidence anchor and reviewer-of-record contact path) instead of the generic error UI
- replace `logger.warn(...)` swallowed branches in dashboard layout with either: (a) reconciled success paths, (b) explicit degradation banners surfaced through the existing pilot/feature-flag context, or (c) a thrown `RuntimeIdentityError`
- add a server-side instrumentation event for every identity-class runtime failure so silent collapse becomes observable evidence
- ensure cognition and governance surfaces render explicit “bounded degradation” states under failure, never empty fail-open shells

## Forbidden Posture

The following are explicitly rejected:

- **ai-first** error remediation (forbidden — error remediation is institutional, not ai-powered, not copilot-driven, not chatbot-driven)
- **autonomous executive** auto-recovery (forbidden — recovery is reviewer-of-record gated)
- silent fall-through to a generic error UI when identity resolution fails (forbidden — silence is incompatible with governance-safe operation)
- **engagement gamification** of error states (forbidden — error UX is institutional, never a productivity optimization, never a workforce ai surface, never an ai assistant or ai ceo affordance)

## Stewardship Cadence

Runtime failure observations are reviewed on the standing daily / weekly / monthly / quarterly stewardship cadence. Any failure pattern that recurs without being either eliminated or formally accepted is treated as continuity-safe drift and escalated.

## Authorized Downstream PR

This document authorizes exactly one runtime hardening PR titled `refactor/nzila-dashboard-runtime-failure-integrity`. It must not bundle auth lineage, organization convergence, persona hardening, or workspace substrate work.
