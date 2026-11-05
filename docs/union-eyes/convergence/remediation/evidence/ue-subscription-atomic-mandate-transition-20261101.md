# Union Eyes Gate 0 — subscription pause/resume mandate atomicity (2026-11-01)

Defect: `DEF-0B3-SUBSCRIPTION-ROLE-TITLE-AND-MEMBER-READ`. Source-level remediation supplement; **not a closure, native qualification, runtime qualification, or institutional approval**.

## Finding

The subscription POST endpoint previously checked `finance:execute` in one tenant-RLS transaction, then invoked `pauseSubscription` or `resumeSubscription` in a separate transaction. The service enforced organization and current status, but did not independently check the caller's live resource-specific mandate. A caller of the service could therefore bypass the route's mandate gate, and the preflight did not share the transition's transactional boundary.

## Permanent source correction

Both service operations now require a live `finance:execute` mandate for the particular subscription **inside their own organization- and principal-scoped RLS transaction**, before the conditional status UPDATE, subscription event and atomic audit. The route retains the administrator role floor, entitlement, rate limit, organization/user checks and input validation; it no longer performs an ineffective separate authorization preflight. A missing mandate throws before mutation. Cross-tenant and wrong-status conditional UPDATEs still refuse. No provider side effects or unissued institutional authority were invented.

## Regression evidence authored

`apps/union-eyes/services/platform-economics/__tests__/subscription-lifecycle-service.test.ts` adds missing-mandate refusal tests for both pause and resume, including no status, event or audit writes, and checks the resource-specific authorization inputs. `apps/union-eyes/app/api/__tests__/billing-subscriptions.route.test.ts` verifies that the route delegates to the guarded service, propagates mandate refusals, and does not use a separate preflight. Existing organization-scoping and audit tests remain.

## Qualification boundary

Source edits and regression-test authoring only. Focused/full Vitest, contract, native PostgreSQL 15/16 (including adversarial mandate revocation and cross-tenant checks), real HTTP/browser and staging have **not been executed against this change** in this run. The last inspected baseline `bce6eb272c86a177cc314eeed82ebfc06c8907ea` passed security regression, native PostgreSQL, App Floor Check and governance attestation, but failed whole-app, contract and HTTP/browser acceptance. Independent reviewer, owner-persona and institutional authority decisions are outstanding. Defect stays PARTIAL; strict 777-defect totals unchanged.
