# UE Gate 0 — education reminder bounded execution and truthful job outcome (2026-10-31)

Source: `reminder-queries.ts` now uses a 301-row database ceiling with `COUNT(*) OVER()` to retain the true due-recipient cardinality without loading every row. The cron processes no more than 300 recipients per kind. A nonzero unprocessed count now yields HTTP 500 through the shared `jobResponse` contract; the scheduler cannot mistake a partial run for success. An adversarial regression exercises 421 due recipients, 300 processed and 121 unprocessed. PGlite query coverage checks the window cardinality.

This is additive source-level remediation, not proof of exact-HEAD Vitest, native PostgreSQL 15/16, HTTP/browser or staging. Existing independent review and institutional gates remain outstanding.
