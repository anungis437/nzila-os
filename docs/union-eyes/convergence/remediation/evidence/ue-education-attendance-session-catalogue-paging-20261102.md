# Union Eyes Gate 0 — attendance session catalogue pagination (2026-11-02)

**Source baseline:** `c39a3e240e2faac0ec2de4ebfab11bd2020306ed`  
**Source correction:** `0fd19b00617ffe5d95dcf2ef5bcb9eb67601de94`  
**Gate disposition:** SOURCE_CHANGED_TESTS_AUTHORED_NOT_QUALIFIED; **NO_GO**.  
**Defect completion and CLOSED credit:** **0**. The frozen 777-defect classifications and the 150-item release-debt index are not edited.

## Failure and correction

The administrator AttendanceTracker previously called `GET /api/education/sessions?limit=100` once and used only `data.data`, silently excluding every session after the first 100. This made an administrator unable to reach legitimate later-session attendance rosters and could misrepresent the catalogue as complete. The existing attendance roster pagination does not fix the session picker.

The attendance session picker now has separate bounded **session-catalogue** pagination, with previous/next controls and an explicit page indicator. The strict `loadEducationSessionPage` adapter requests 100 rows per page, verifies the actual generic CRUD envelope and pagination metadata, and rejects incomplete rows, foreign-tenant records, invalid pages and failed HTTP responses. No malformed response is treated as an empty successful catalogue. Changing catalogue page or organization clears the prior selected session, roster and selection; generation guards prevent stale responses from being displayed after a tenant switch. This does not alter the audited registration-scoped attendance PATCH.

## Source and authored regression tests

- `apps/union-eyes/components/education/admin/AttendanceTracker.tsx`
- `apps/union-eyes/components/education/admin/session-catalogue.ts`
- `apps/union-eyes/components/education/admin/__tests__/session-catalogue.test.ts`

Adversarial tests exercise a 101-session catalogue across two pages, request shape, last-page count, cross-tenant row rejection, invalid/missing pagination, incomplete records, invalid pages and HTTP refusal.

## Qualification boundaries

The preceding HEAD `c39a3e240e2faac0ec2de4ebfab11bd2020306ed` passed the seven substantive GitHub CI workflows (App Floor Check, full regression, security regression, native PostgreSQL acceptance, disposable HTTP/browser acceptance, governance attestation and their associated checks). Those are **baseline results only**, not proof for this correction. At evidence authoring the new HEAD has not established full Vitest/contract, real PG15/16, real HTTP/browser or staging qualification; tests above are **authored**, not independently executed/accepted. No institutional reviewer, owner persona or authority decision is represented as approved.

Further obligations include route-specific native database and browser evidence, governed attendance corrections, full member/steward/officer/financial/WorkAid journey qualification, all 777 recorded defects and Gate 0C.4 institutional approvals.
