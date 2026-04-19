# Union Eyes Admin Ops Readiness

## Verdict

GO WITH RESTRICTIONS.

Union Eyes has enough operational substrate for a guided pilot: audit logging, seed tooling, staff-side workflow APIs, and evidence export. It does not yet show the operational discipline required for an unrestricted rollout across multiple locals or role groups.

## Strengths

1. Admin and platform routes exist for pilot seeding, user listing, and system operation.
2. Audit and evidence generation are present across several staff-side case actions.
3. Structured logs, monitoring hooks, and pilot metrics are integrated in the newer case APIs.

## Readiness Gaps

1. `app/[locale]/dashboard/admin/layout.tsx` is guarded at `officer`, not a narrower admin role. That broadens operational surface area.
2. Existing smoke coverage is shallow. `e2e/smoke.spec.ts` only validates public pages and health. `e2e/dashboard.spec.ts` is basic and does not prove pilot-critical operations.
3. The product contains both legacy and hardened APIs, which increases operator confusion during incident handling and support.
4. The most important operational runbook is missing from the product itself: which routes are approved for pilot use and which are explicitly off-limits.

## Required Operating Model

1. Nominate a small steward/admin pilot cell rather than opening the system broadly.
2. Maintain a route allowlist for pilot operations: case intake, assignment, notes, transition, audit, export.
3. Explicitly disable or hide the member self-serve claim creation path until rewired.
4. Use seeded pilot data only in non-production validation, never as a substitute for authenticated end-to-end go-live checks.

## Launch Position

Admin operations are adequate for a staffed pilot cell with strong oversight. They are not yet mature enough for a loose self-serve deployment.