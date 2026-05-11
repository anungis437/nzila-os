# Static Analysis Suppressions

_Last updated: 2026-04-23_

This register documents intentional suppressions for analyzer findings that are false positives after code-level safeguards.

## Policy

- Suppress only when a finding is demonstrably non-exploitable.
- Keep suppressions line-scoped and documented in code comments.
- Record file, rule summary, rationale, and review owner/date.
- Re-evaluate suppressions during security reviews and major refactors.

## Active Suppressions

None currently.

## Resolved Entries

### Zonga launch-readiness static reads (resolved)

- File: `apps/zonga/tests/launch-readiness.test.ts`
- Finding summary: Potential file inclusion attack via reading file
- Resolution:
  - Refactored to preload static source files from literal paths.
  - Removed dynamic helper path resolution/read flow that triggered the analyzer.
- Residual risk: None identified
- Owner: Platform Security
- Review date: 2026-04-23

### Zonga service worker same-origin fetch (resolved)

- File: `apps/zonga/public/sw.js`
- Finding summary: HTTP request might enable SSRF attack
- Resolution:
  - Replaced dynamic fetch target with strict literal-path network fallback (`'/'`, `'/en/dashboard'`).
  - Non-whitelisted paths now use cached dashboard fallback.
- Residual risk: None identified
- Owner: Web Platform
- Review date: 2026-04-23

## Exit Criteria

Remove each suppression when either:

- The scanner rule supports path/dataflow context sufficient to resolve the false positive, or
- The implementation is refactored so the flagged pattern no longer appears.
