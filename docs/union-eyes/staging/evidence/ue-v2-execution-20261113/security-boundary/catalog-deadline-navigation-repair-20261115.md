# Catalog concurrency, deadline locks, and settings verification

The serving application remains `2107feeb1c2949042d97bd0606efb18e7aa95beb`.
These source repairs are not deployed and do not establish STAGING GO.

## Confirmed problems and repairs

- Five simultaneous health requests each repeated the same 28 catalog queries through the
  correctly capped database pool. Their catalog checks took 1.92 seconds. Share only an
  inspection already running for the same contract, database, source and admission context,
  including across separately bundled health/readiness modules. Discard every settled result
  immediately; never cache an earlier admission decision. Explicit executors remain isolated.
- Formal reassignment could acquire the organization audit lock before the parent grievance
  row, reversing deadline management's parent-first order. Lock that scoped parent first.
  Legacy deadline confirmation also locks the parent before the deadline, re-reads the
  authoritative relationship/state, and then evaluates current case authority.
- The persona verifier accepted the initial settings URL before its streamed redirect, then
  interrupted navigation with a mobile reload. Derive the exact destination from the real
  organization-settings policy and verify separate desktop/mobile visits. Preserve all HTTP,
  origin, access-denial and viewport checks; do not retry writes or relax expected access.

## Evidence and its limits

- Focused validation: catalog **32 passed**; deadline/assignment/continuity **70 passed,
  3 opt-in native PostgreSQL cases skipped**; navigation/request safety **23 passed**.
- The uncommitted-source private native catalog experiment used the actual runtime database
  identity and pool size one. Three alternating five-request rounds took **1,957 / 1,936 /
  1,976 ms** with separate inspections and **371 / 381 / 368 ms** with the repair. The bundled
  source manifest is recorded. This is a native comparison, not a deployed HTTP SLO result.
- The canonical performance run's original wrong-target failure and subsequent real-target
  latency failure remain FAIL. The existing environment target was corrected without changing
  thresholds. Require the deployed candidate to pass the existing 500 ms p95 / 1,500 ms p99 gate.
- Actual serving-source intake-case deadline management passed **22** checks. The fresh formal
  grievance flow passed **42**, including actual staff create/reschedule/complete/cancel,
  represented-member read-only access, EN/FR browser rendering, and assignment revocation.
  Synthetic cases/deadlines remain; temporary fixture authority was retired and original test
  memberships restored. A prior private-verifier card-expansion mistake remains recorded FAIL.
- The original issued private document URL actually expired and returned **403
  AuthenticationFailed** after its original expiry. No clock, signed query or lease was changed.
- English/French formal-case deadline and bounded-member screenshots were inspected. The
  credential-free JSON records beside this file retain exact observed application provenance;
  private screenshots and original failures remain separately retained.

Broad local lint/typecheck/test/governance attempts and their environment failures are recorded
separately; they are not counted as PASS. Exact committed-source CI, native admission, reviewed
staging deployment, all seven corrected persona runs, and final runtime reconciliation remain
required. Finance feature implementation, production deployment, Phase 3B and global SaaS
readiness are outside this repair. The global SaaS gate remains NO_GO with 777 frozen entries
and zero closures. CHG-2026-0114's continuing solo-founder staging delegation applies.
