# Union Eyes Gate 0 — runtime case-journey QA clock correction

Status: **SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED**. This is a test-fixture repair, not a production policy relaxation, defect closure, or institutional acceptance.

At baseline `e11e53ab255dba5d361b4ccf347ab158a61b4214`, the production-build HTTP/browser acceptance failed two real case-escalation journeys with HTTP 422 and `72 hours remaining`. The QA helper `ageQaCase` backdated `claims.updated_at`, while the production FSM uses `slaClockStart(claim)` sourced from `claims.status_changed_at` (migration 0049). Backdating the last edit could not satisfy the minimum-time-in-state rule.

The helper now updates only `status_changed_at` for the fixed QA organization, validates the elapsed-hours input, and refuses a missing or non-QA case. The production transition minimum-duration policy remains unchanged. Regression tests at `apps/union-eyes/scripts/runtime/__tests__/db-inspect-qa-clock.test.ts` assert the canonical column, QA-organization predicate, input bounds and missing-row refusal.

Pending: exact-HEAD focused Vitest, native PG15/16, production-build HTTP/browser rerun of both journeys and restart persistence. A passing helper unit test alone does not establish end-to-end case escalation. No 777-defect completion credit is awarded.
