# Union Eyes Gate 0 — scanner-safe unsubscribe engineering (2026-10-31)

**Disposition:** Source and regression test changes committed; not independently executed or CLOSED. Gate 0 remains NO_GO.

**Affected frozen provenance:** DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC and related unsubscribe/consent defects in the original 777-defect population. This is additional evidence for an existing PARTIAL family, not a new eliminated-defect credit.

**Problem:** A signed unsubscribe URL was previously processed by GET, which mutated preferences, campaign statistics, list subscriptions and consent records. Automated email link scanners and browser prefetch could therefore unsubscribe a recipient without a deliberate request.

**Correction:** GET now verifies the action-bound token and displays a bilingual confirmation form without accessing the database or modifying any record. The form submits POST to the same signed URL. POST retains the existing campaign-scoped and explicitly signed global-opt-out transactional mutations. Direct POST remains compatible with one-click unsubscribe clients. Responses suppress referrers and caching. No signed token is reflected into HTML.

**Regression source:** apps/union-eyes/app/api/__tests__/communications-unsubscribe.route.test.ts exercises no-write GET, forged GET, and explicit POST. apps/union-eyes/app/api/__tests__/communications-public-mutation-isolation.pglite.test.ts exercises the read-only GET against real in-process SQL and preserves POST tenant-isolation tests.

**Qualification still required:** Run focused and complete Vitest/contract, native PG15/16, real HTTP/browser and staging acceptance on the exact commit. Verify all outbound senders' List-Unsubscribe and List-Unsubscribe-Post headers, supported mail-client one-click behavior and institutional approval of global opt-out semantics. No human or independent release decision is asserted.
