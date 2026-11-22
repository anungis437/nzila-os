# Union Eyes V2 current base candidate

Proposed source: `57728a2a750b28ee3dfd4b9eb82c54e03ad0bed3`, the merge commit of [PR #1269](https://github.com/anungis437/nzila-os/pull/1269).

- Exact-head CI passed on `30572d9acf6b273df70c4ac3aa66c484ff5d86d0`, with no failures.
- V2 engineering qualification passed: four browser profiles at 11/11, and 20 automated WCAG 2.1 A/AA scans with no critical or serious violations.
- The native authority kernel passed: 25 suites, 470 tests.
- The re-enabled red-team suite passed.

The [main-only build](https://github.com/anungis437/nzila-os/actions/runs/44949770898) passed. The qualified application image is `nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:7b6c8ebfed04a70d69283e31480c39a1989e93b283b24eed48c784e6000d590e`.

The [protected rollout](https://github.com/anungis437/nzila-os/actions/runs/44962785190) applied infrastructure but failed application readiness. On November 22, the new revision had no ready replicas and no traffic; the prior revision retained all traffic. Read-only database inspection confirmed that seven required tables, five nullable columns and the `ue_external_read_reader` role were absent. The rollout did not execute a forward schema upgrade.

A data-preserving forward upgrade is under qualification. It retains installed migrations, bootstrap receipts, historical tables, existing rows and sequence values; it does not restore a fresh database over live staging. Its staging rehearsal must roll back and verify the original catalog before an apply operation can bind the exact rehearsal plan and preimage. Local proofs are engineering evidence only.

The [disposable PostgreSQL 16 proof](evidence/ue-v2-forward-upgrade-20261122/local-managed-preservation-proof.json) preserved 779 original tables, six synthetic rows and 20 sequences, removed temporary privileges, passed packaged catalog admission and verified rollback after an injected DDL failure. Its tool bytes are individually hash-bound; it is not a live-staging receipt.

Still pending: qualification and normal admission of that upgrade, its protected staging rehearsal and application, successful startup and rollout of this exact image, then deployed persona and base-action qualification. **STAGING_NO_GO** for full base release.

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
