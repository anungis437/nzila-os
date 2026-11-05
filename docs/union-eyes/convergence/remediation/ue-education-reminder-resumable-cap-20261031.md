# UE Gate 0 — resumable bounded education reminders (2026-10-31)

The 300-recipient job cap must not starve later recipients. Both education reminder queries now anti-join the durable per-organization/member/source/tier in-app marker and use stable source-ID ordering. A subsequent cron run skips already-claimed deliveries and advances through the remaining eligible recipients. The window count continues to report how many remain in the current run. The PGlite regression inserts real claimed markers and verifies both session and certification exclusions while preserving an unclaimed member's reminder.

This is source and regression-test evidence only. Exact-HEAD focused tests, real PostgreSQL 15/16, complete suites, HTTP/browser and staging acceptance are not asserted. A provider-ambiguous delivery remains held for manual reconciliation, not silently resent.
