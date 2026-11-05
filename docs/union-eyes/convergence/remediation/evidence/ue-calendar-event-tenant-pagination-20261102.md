# Union Eyes — Calendar event tenant-bound pagination (2026-11-02)

## Scope and original defect family
The member calendar-events collection read previously returned at most 100 records with no offset or continuation contract. A member with 101 authorized events could not reach the final event. The route used a shared database read with explicit tenant predicates, but lacked an explicit transaction-bound tenant context. This correction is supplementary engineering evidence across calendar data integrity, privacy and member journeys. It is **not** independent acceptance or defect closure.

## Source correction
- `apps/union-eyes/app/api/calendar/events/route.ts`: adds bounded `limit` and `offset` pagination (maximum 100), fetches one extra record to report truthful `hasMore`, and preserves the existing `data` and `limit` response fields.
- The read now executes through `withRLSContext({ organizationId, userId }, ...)` and still requires both event and calendar organization predicates, personal-calendar owner restrictions and event privacy/organizer restrictions.
- Ordering adds the event ID as a deterministic tie-breaker when start times are equal.
- Missing organization or user identity continues to fail before database access.
- `apps/union-eyes/app/api/calendar/events/__tests__/pagination.test.ts`: authored regression cases for 101-event continuation, later pages, tenant-bound SQL predicate construction, owner/privacy predicate construction, bounded pagination and absent identity.
- `tooling/contract-tests/server-action-auth-required.test.ts`: separately corrects a full-contract CI false positive. The original test classified any source file containing the string `'use server'` as a server action, including a TypeScript AST analyzer comparing that literal. It now recognizes executable module or function-body directive prologues, with positive and negative tests. The auth requirement for genuine server actions remains unchanged.

## Provenance and qualification
- Baseline branch HEAD inspected before changes: `6b077fb4fc6ca8d9e81e353a67e28a2460b406f0`.
- Baseline CI: App Floor Check, governance attestation, security regression, native PostgreSQL acceptance, disposable HTTP/browser acceptance passed; full regression failed because the server-action auth contract falsely flagged `apps/union-eyes/scripts/lib/sql-census/liveness.ts`. The contract job reported 1 failed / 10,012 passed tests; whole-app and financial-remittance jobs passed.
- Contract parser correction commit: `7882eeeda4861aa78ffd850ffb3a56e8e6e8887b`.
- Calendar source correction commit: `fcc2b03404d61576d426e8a6b03c745c565b0826`.
- Calendar regression test commit: `0a5245b9ced03f876daf4569dc368918d7c2c4f4`.
- Source-level: changes authored and GitHub accepted; exact-HEAD CI results are not yet attributed to the new commits.
- Unit/contract: authored, execution pending.
- Native PG15/16: the baseline workflows passed, but the new calendar route has no exact-HEAD route-specific native proof.
- HTTP/browser/staging: baseline workflow passed; new calendar pagination and auth contract lack exact-HEAD runtime acceptance.
- Institutional: independent reviewer, owner-persona and institutional authority decisions remain unratified.

## Credit and safety
No frozen classification or 150-item priority-index mutation. No defect receives CLOSED or verified credit from this source change. The original 777 defects and 111 capabilities remain in scope. No PR merge, financial mandate, authority decision or production promotion is implied.
