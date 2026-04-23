# UNION EYES PRODUCTION GATE

Date: 2026-04-23
Purpose: Explicit go/no-go checklist for production release

## Current Gate Result

- Result: NO-GO
- Primary blocker: staging and production topology are not cleanly separated in live runtime behavior.

## Mandatory Prerequisites

1. Infrastructure and topology
- Dedicated staging and production runtime boundaries proven.
- Production hostnames mapped only to production app.
- Staging hostnames mapped only to staging app.
- Health/readiness endpoints green on both surfaces.

2. Auth and access
- Local auth, invite, magic-link, and policy endpoints validated.
- MFA enrollment/challenge flows verified for required roles.
- Admin lifecycle controls verified.

3. Data and migration
- Drizzle and Django migration states are current.
- Required table families verified in production DB.
- Backup and restore procedure validated and timestamped.

4. Integrations
- Production-contracted integrations are live-tested.
- Fallback behavior tested for non-critical dependencies.
- Integration ownership and escalation path documented.

5. AI controls
- AI endpoints are advisory-only and review-required.
- Global or org-level AI disable path documented and tested.
- AI observability/audit metadata captured in production logs.

6. Mobile and UX
- Critical mobile workflows tested with production-like data.
- Desktop-preferred pages documented to avoid unsupported claims.

7. Marketing/copy alignment
- No unsupported certification/integration/mobile/AI claims.
- Slogan approved and correctly represented:
  - Global vision, local action
  - Vision globale, action locale

## Required Green Checks

Release cannot proceed until all are green:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. Runtime smoke for all official domains and health endpoints.
5. Production DB parity evidence attached.
6. Integration register signed off by owners.

## On-Call and Support Expectations

- Named primary and secondary on-call for release window.
- Incident comms channel prepared.
- Rollback operator assigned and rehearsed.

## Backup/Restore Expectations

- Backup schedule active and verified for production DB.
- Latest restore test date recorded.
- Recovery target and restore duration agreed before go-live.

## Unresolved Risks (Current)

1. Topology drift risk between staging and production surfaces.
2. Incomplete end-to-end live proof for some optional integrations.
3. Broad surface area requires stricter smoke-test coverage to avoid blind spots.

## Production Go Decision Rule

Go only when every mandatory prerequisite above is green and unresolved risks are accepted in writing by product + platform owners.
