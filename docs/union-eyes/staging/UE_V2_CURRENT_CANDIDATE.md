# Current staging and acceptance delta

Staging serves `c09de4557236b615fad0a1c992d6ee2b8820bf62` at 100% on `nzila-ue-v2-staging-app--relc09de45572`, image
`sha256:6e22096ccc3d1a1cd2473cec673b7d32fe5c03d44f4973b80f66230b100e5518`.
PRs #1235/#1236 were normally merged at workflow/IaC `c47cb1f33d7cf05b549be617bc0e8411b56db996`. Immutable build
43718756258 and protected deployment 43720514263 supplied it. Readiness and serving
identity pass. **Base STAGING remains NO_GO; accepted candidate is null.**

Q fails unchanged canonical performance: run 43718734553 attempt 2, job 132833725876,
exact artifact 14164058711 records 609.794ms p95 against 500ms, max 1102.744ms,
1028 requests and 1542 passed assertions with zero custom errors. Expected favicon 404
is excluded from custom errors. Actual Q attribution records `/en-CA` p95 550.584ms
versus health 325.185ms; full public HTML was 587,373 EN / 640,563 FR bytes.

A fresh actual Q browser proved another base defect: EN→FR→EN client navigation
translates the body and picker, while `html.lang` and the shared staging notice remain
English. The same document is retained, with no translation or application exceptions.
The failed observation remains in `actual-root-locale-switch-c09de455-failure.json`.

D `d57aa1f3dde18d44120141c22f3e4fbf8c062153` from PRs #1237/#1238 was normally merged at `a1bc22389c7eb4e8eeffc3ab742ffde6b888f63a`.
Immutable build 43733296236 passed; its six native phases passed and the recovery copy
was stopped. D was **never deployed**: its rollout controllers were stopped before
staging dispatch to include the root locale correction in the final candidate. Its source,
CI, build and native proofs remain D evidence and cannot satisfy E acceptance.

Proposed E is `0fa684a15641e84cb2aa3c94a2fad49428d64f60` (source PR #1239). This integration binds that exact
source. It retains the bounded public translation payload and original HTTP 307 redirects,
and updates document language and the staging notice from the active route locale. Home
messages remain 4044 EN / 4481 FR JSON bytes versus full 464590 / 506270. All 19 focused
tests, scoped typecheck/lint, seven real Next browser transitions and HTTP 307 pass. The
framework preserves full app translations, Toronto timezone and the document across
locale changes. These proofs do not establish real staging authentication or HTTP SLO.

Fresh E native export/restore/repeat/privileges pass with 776 tables, 6267 statements and
24,576 catalog objects, digest `8fd6dc431fdc911a0717dc008220f2bf58b4f4cee2ff35c884bb02fe8e68e15f`.
Seven tools compile/load with 488 exact-source modules. Backend source bytes match Q.
Six bundle hashes match; the deadline helper has one reviewed compiler interop flag
difference. Every fresh E hash is retained. Configured signed qualification is still required. All five required
broad local commands ran: docs PASS; lint/typecheck/governance audit/test:fast FAIL.
Aggregate results are 2577 failed / 528 passed / 1 skipped files and 19 failed / 7788 passed /
12 skipped tests. The new root presentation test stops before its body at existing shared
TS-config resolution. No new assertion failure headers appear. Lint/governance match D;
typecheck selects a different unchanged task. Broad FAIL is retained.

Remaining E work is exact source/integration CI, normal main admission, signed native
qualification and retained-copy cleanup, read-only primary retention, immutable build, fresh
concrete reviewed rollout, unchanged performance, all seven personas and all base journeys,
paired same-cookie revocation and original full-hour document expiry, workers, recovery,
final audit/seals, telemetry and EN/FR desktop/mobile visual review. All 17 required criteria
remain pending. Historical S runtime proofs remain indexed under S.

Staff create, reschedule, complete and cancel case deadlines in the app. Dates are entered
by staff; automatic legal calculation and intake-case email reminders are not claimed. Formal
reminders remain in scope. Finance/dues persistence and Financial Officer 2.1 are excluded;
sensitive finance access must fail closed. Preserve primary data, 40 immutable migrations
and signing keys. One founder operates both GitHub accounts; continuing delegation ends
2026-11-16T23:59:59Z without extension. No production, global SaaS promotion, frozen 777
closure change or Phase 3B. [Contract](UE_STAGING_GO_CONTRACT.json) ·
[Evidence index](evidence/ue-v2-execution-20261113/security-boundary/index.json).
