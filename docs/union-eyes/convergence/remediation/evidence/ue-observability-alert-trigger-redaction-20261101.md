# UE Gate 0: observability alert trigger-data minimization (2026-11-01)

## Scope and defect
`DEF-0B3-ALERT-INBOX-MEMBER-FLOOR-NO-REDACTION`. The realtime alert endpoint currently requires an officer role, but its service selected and returned the full JSON `alert_executions.trigger_data`. The system currently stores only organization, signal and count, but the database column is extensible and may contain member, case, provider or other sensitive details. A role floor alone is not a privacy projection.

## Source correction
`getRecentRealtimeAlerts` now projects trigger data through a strict allowlist of three existing realtime signal kinds and a nonnegative safe-integer count. Unknown signal kinds, malformed data and all unrecognized fields are omitted. Tenant-scoped RLS execution, organization predicates, ordering and pagination are retained. The officer role and entitlement checks in `app/api/alerts/realtime/route.ts` are unchanged; no new institutional audience is invented.

## Regression cases authored
`services/observability/__tests__/realtime-alerting-service.test.ts` asserts that nested member/case/provider details cannot appear in returned JSON, unknown signals fail closed and malformed counts do not leak raw values. Tests are authored, **not** independently qualified by this evidence document.

## Qualification and authority still required
Exact-HEAD focused and complete Vitest/contract; native PostgreSQL 15/16 with tenant RLS; production-build HTTP/browser; staging; independent reviewer, owner-persona and institutional authorization of the officer alert audience. No defect CLOSED or implementation-credit change is claimed. Frozen Gate 0 provenance is unchanged.
