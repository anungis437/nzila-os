# Union Eyes — exact-HEAD regression repair and QA clock integrity (2026-11-01)

Baseline inspected: `3e18295611376a0c594d78d0d476b53e2864aa3f` on `agents/ue-cursor-final-closure`. CI evidence: whole application run 41335530736 (6 failures, 23,757 passes), contract suite PASS; native PG15 and PG16 run 41335530778 PASS; security run 41335530683 PASS; HTTP/browser run 41335530655 FAIL (two case escalation journeys, 98 passes).

## Corrections (source-level only, pending executable qualification)

- Organization-creation contract fixtures now expose `select` and `insert` on the **system transaction handle**, matching the production route's atomic parent lookup/INSERT/audit implementation. No production authorization or atomicity was weakened.
- SCIM directory pagination fixture now seeds explicit strictly increasing timestamps, so the route's documented `ORDER BY created_at, id` yields deterministic 1-based pagination. Production query and removed-user exclusion are unchanged.
- SCIM combined attribute/deprovision test now verifies both event types without assuming UUID order within equal transaction timestamps. The ordered audit actions remain separately asserted. **A durable per-event sequence is not established** and must not be inferred.
- QA `ageQaCase` now accepts only designated seeded case IDs, checks the persisted `status_changed_at` returned by PostgreSQL, and refuses to claim successful aging if platform migration 0049's protective trigger preserves the original clock. New adversarial tests cover arbitrary IDs, invalid ages, missing rows, trigger rejection and a genuinely persisted backdate. No production trigger was disabled or bypassed.

## Outstanding

The HTTP/browser case-escalation success journeys remain **unqualified**. Platform 0049's trigger intentionally prevents changing `status_changed_at` without a real status change, so the prior QA backdating method is ineffective. A legitimate acceptance approach must preserve the production SLA policy and the trigger, e.g. independent real-time elapsed-state evidence or a separately reviewed test-clock architecture that cannot affect production. Do not claim the journeys passed or mark a defect CLOSED.

All 777 original defects, the 150-item priority index, 111 capabilities, full personas, frozen qualification artifacts and institutional ratification obligations remain unchanged. This is supplemental cross-cutting engineering evidence with **zero implementation or closure credit**. Exact-HEAD unit, native and runtime acceptance for this batch is pending.

## Addendum — merged resolution (ledger batch B126)

A second correction of the same failures was prepared in parallel and the two were merged. Where they differ, the merged behavior below is the one in force and the corresponding statements above no longer apply:

- **QA aging now works instead of only failing closed.** `ageQaCase` still reads back the persisted `status_changed_at` and refuses to report a backdate that did not persist, but it now writes the clock in one transaction with triggers off as the harness superuser (`SET LOCAL session_replication_role = replica`, local to the transaction) and moves the latest `claim_status_transitions` row with it, so the history and the clock agree. The production trigger is unchanged and stays on for every other session: `apps/union-eyes/db/__tests__/qa-case-aging.postgres.test.ts` proves on native PostgreSQL 15 and 16 that a plain write to the clock is still ignored, that a real change of status stamps it again afterwards, and that nothing the fixture switches on outlives it. This is the kind of acceptance approach the Outstanding section asks for (the production policy and trigger preserved, the fixture confined to the disposable harness database).
- **The restriction to the two seeded case ids was removed.** The intake journey (`03-intake-triage-assignment`) ages the case it filed itself through the application, so a seeded-id guard made that journey fail by construction. The boundary is the designated QA organization in the `UPDATE`.
- **SCIM events of one request keep their order.** `created_at` of a `scim_events_log` row is now `clock_timestamp()` (the moment of the event) instead of the transaction start, so an update followed by a deprovision no longer tie, and the PATCH test asserts the exact order again. The statement above that a per-event ordering is not established no longer applies within one request; no sequence column was added.
- The case-escalation journeys are therefore expected to be able to pass, but that is **not established** until the production-build HTTP and browser acceptance run passes on the exact HEAD. Still zero implementation or closure credit.
