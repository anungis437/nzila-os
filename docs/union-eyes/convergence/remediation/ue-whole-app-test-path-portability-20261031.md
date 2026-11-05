# Union Eyes whole-app regression path portability — 2026-10-31

Baseline whole-app run `41173179859`, exact SHA `9c9cad7efe168d4b387a238ac38ea921c96e6f4e`, reported 150 failed tests and 22,079 passed. Many source-contract and PGlite tests assumed `process.cwd()` was `apps/union-eyes`; the CI command executed from the repository root, so those tests read nonexistent paths rather than exercising their asserted behavior.

This batch anchors file reads to each test module's location using `fileURLToPath(new URL(relativeAppRoot, import.meta.url))`. No production control was weakened. The first group includes migration 0038, whose fixture was already corrected to mirror the minimal Django SSO stub. These are test harness corrections only, not acceptance of the underlying behavior. Any real source assertion failures revealed after path repair remain defects to remediate, not candidates for suppression.

Exact-HEAD Vitest/contract, native PostgreSQL 15/16, disposable HTTP/browser and staging evidence remain pending. Frozen defect provenance, source-level remediation statuses, and institutional gates are unchanged.
