# Union Eyes V2 current base candidate

Proposed source: `57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3`, the merge commit of [PR #1269](https://github.com/anungis437/nzila-os/pull/1269).
- Exact-head CI passed on `30572d9acf6b273df70c4ac3aa66c484ff5d86d0`, with no failures.
- V2 engineering qualification passed: four browser profiles at 11/11, and 20 automated WCAG 2.1 A/AA scans with no critical or serious violations.
- The native authority kernel passed: 25 suites, 470 tests.
- The re-enabled red-team suite passed.

Still pending: the main-only build, a reviewed what-if, the protected rollout, and deployed qualification. **STAGING_NO_GO** for full base release.

Observed staging source remains `cccfc8c311a1017f80241bf089c00ef0c6828751`. Its deployed evidence keeps its own provenance and is not acceptance of this candidate.

The candidate adds:
- transitive authority classification of every mutation export;
- native-PostgreSQL authority-kernel coverage;
- browser accessibility repairs found by the new scans;
- bilingual catalog completeness;
- the counsel assertion signature verifier.

Automated scans are not a manual assistive-technology audit. Translation quality and physical devices are not verified.

Default menus, kernel case permissions, immutable migrations and live data remain protected. The [action ledger](UE_V2_BASE_ACTION_COVERAGE.json) is unfinished.

CHG-2026-0114 ends `2026-11-23T03:00:00Z` under the founder window record. Production deployment is excluded, as are Finance/dues and Financial Officer 2.1. Global programme readiness and Phase 3B remain held.
