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
