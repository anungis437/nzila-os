# Union Eyes Gate 0 — education attendance lifecycle and roster contract

Date: 2026-11-02. Branch: `agents/ue-cursor-final-closure`.
Starting exact-HEAD baseline: `36e1b83ee27669537be894480785b2b0e6b11926` (seven substantive workflows completed successfully at baseline).

## Source changes

- The steward attendance PATCH retains authenticated organization scope, a tenant-bound session/registration relationship, row locking and same-transaction mandatory audit. It now rejects cancelled, withdrawn, waitlisted, completed, unknown-status, already-completed, cancellation-dated and unapproved registrations. Unknown completion/approval values refuse. It reasserts active status and incomplete state on the update. Marking absence clears stale hours; a positive hour assertion with `attended=false` refuses.
- The roster GET now returns only the fields it actually owns, including completion state, with stable 100-row pagination and a `hasMore` flag rather than silently truncating a 500-row roster.
- The AttendanceTracker previously called nonexistent POST methods with unsupported `memberId`, `registrationIds` and `attendanceDate` bodies, misread nested `withApi` response envelopes, displayed unavailable name/email fields and assumed bulk success. It now calls the real per-registration PATCH; checks that the nested persisted row id and attended state match; reports partial batch results; invalidates stale organization/session responses; renders only factual fields; pages through the roster; scopes exports to the displayed page; and neutralizes spreadsheet formulas.
- Pure policy and client regression tests cover lifecycle, unknown authorization states, contradictory attendance hours, route/method and payload binding, fake-success refusal, and CSV injection.

## Source and test paths

- `apps/union-eyes/app/api/education/sessions/[id]/attendance/route.ts`
- `apps/union-eyes/app/api/education/sessions/[id]/attendance/attendance-policy.ts`
- `apps/union-eyes/app/api/education/sessions/[id]/attendance/__tests__/attendance-policy.test.ts`
- `apps/union-eyes/components/education/admin/attendance-client.ts`
- `apps/union-eyes/components/education/admin/__tests__/attendance-client.test.ts`
- `apps/union-eyes/components/education/admin/AttendanceTracker.tsx`

## Evidence and remaining gates

Source commits through `a208e09d7ca5167f8b5c7d6aab0f345367f6d900` are authored, not independently accepted. No new defect completion or CLOSED credit. Exact-final-HEAD Vitest/contract, route-specific real PostgreSQL 15/16, full HTTP/browser and staging acceptance are **not claimed**. Institutional authority for attendance corrections, reviewer and owner-persona ratification remain open. The existing DELETE fail-closed correction path is unchanged. Session catalogue is paginated by the generic API; this UI currently displays its first page, so a complete cross-page session picker remains future work. No bulk atomic transaction is claimed; each registration update is separately audited and partial outcomes are explicit. Frozen Gate 0 source classification and all 777 defect IDs are preserved.
