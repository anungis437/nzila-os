# S2.02-PREIMAGE acceptance review (2026-11-28)

This record holds no counts, ledger rows, receipt values or credentials. The private preimage was reviewed on the founder's machine only.

| Flag | Value |
| --- | --- |
| `S2.02_PREIMAGE_COMPLETE` | NO |
| `S2.02_LEGACY_GATE` | INDETERMINATE |
| `STEP_2_ENGINEERING_COMPLETE` | NO |
| `STEP_2_ACCEPTED` | NO |
| `STAGING_GO` / `PRODUCTION_GO` | HELD / HELD |
| `UE_SAAS_OPERATIONAL_READINESS` | NO_GO |
| `fullReadiness` | NOT_YET_PROVEN |

**Recommended decision: do not accept yet.** One material gap remains (B1 below). Every other criterion passes. Lifting the staging deployment freeze is not staging release authorization.

## Evidence reviewed

- Plane A (runtime): runs 46036574426 and 46038068694, from `main` `2927b25ca`.
- Plane B (privileged): run 46084209107, from `main` `445451712`. One REPEATABLE READ transaction.
- Offline assembly `preimage-20261127-r2`. Private evidence SHA-256 `7e326e995dcafb73def9468b2f3e61b0129181818680038d4dd47b20785afbec`. The committed summary is [preimage-20261127/preimage-summary.json](preimage-20261127/preimage-summary.json).
- Supporting runs: 45940281038, 46019964268, 46048025241 and 46072263185 (refusals and superseded chains). Receipts for all seven runs are in this folder.
- Frozen contract: the S2.02-PREIMAGE package in `UE_STEP2_WORK_BREAKDOWN.json` and `UE_STEP2_DEPLOYMENT_AND_DATA_PLAN.md`, at plan commit `0a52d6cb1` (PRs #1310 and #1312 are still open).

## Integrity

- Re-running `--assemble` from the raw artifacts reproduced the private preimage byte for byte: same SHA-256, identical summary.
- Every private run folder passes its `SHA256SUMS`, and that file is identical to the committed copy.
- For each of the seven runs, the `catalog.json` SHA-256 printed in the GitHub job log matches the private copy, and the job log's artifact zip digest matches the artifact API.

| Run | `catalog.json` SHA-256 (prefix) | Artifact zip digest (prefix) |
| --- | --- | --- |
| 45940281038 | `203d1f0a9015d152` | `af32716dbb327bfd` |
| 46019964268 | `3e1dae73a32914a4` | `21a6fd22ce053aec` |
| 46036574426 | `b9b696fc2d73777c` | `f343250e1280d32d` |
| 46038068694 | `c5f612d4101f3cf1` | `b81f31aa4ada143e` |
| 46048025241 | `0482faeb10fdaf4c` | `3f5a5cb69dc3eceb` |
| 46072263185 | `a4369dfee5c27c9f` | `7d6fd253dd251c53` |
| 46084209107 | `a2340df148cfece2` | `24e6f6836f11c661` |

## Acceptance criteria

| # | Criterion (frozen contract unless noted) | Result |
| --- | --- | --- |
| 1 | Fresh observation; historical receipts not reused | PASS. All three accepted runs were `workflow_dispatch` from `main` on 2026-11-27. |
| 2 | Names the command, time, revision, traffic weight, image digest and catalogue | PASS. Command: the private catalogue workflow and controller. Times: 16:53:30Z (A) and 23:53:51Z (B). Revision `nzila-ue-v2-staging-app--rel6a60c95c9d`, image `…union-eyes-v2@sha256:2bf18216…`. The controller refuses to create a job unless that revision is Healthy at 100% traffic (`revisionAccepted`), so each accepted run proves 100%. An independent read at about 02:55Z on 2026-11-28 showed the same revision at 100%, Healthy. |
| 3 | Serving-SHA conflict resolved | PASS at the application layer: the serving image is the digest built for pin `6a60c95c`. Not yet at the database layer: see B1. |
| 4 | PostgreSQL version | PASS: 16.15, identical on both planes. |
| 5 | Migration history / installed migrations | **NOT MET (B1).** The Drizzle ledger was read: 40 rows, contiguous, each matching a migration file on `main` byte for byte. But a v2 database is installed by bootstrap-v2 from a source plan. Its system of record is the installer receipt, which was counted but not read. The ledger covers 40 of the serving pin's 150 journal entries, so it cannot establish the installed state on its own. |
| 6 | Owners and ACLs | PASS: 810 relations (790 tables and 20 sequences). The relation digest covers every relation kind, so there are no views, materialized views, partitioned tables or foreign tables. |
| 7 | RLS attributes and policies | PASS: RLS on all 790 tables, 1,819 policies. Six RLS-disabled tables, none readable by the runtime role. |
| 8 | Application-role attributes, `BYPASSRLS` included | PASS: 34 roles, 71 memberships. The runtime role and login do not bypass RLS. The administrator bypasses RLS and is not superuser. |
| 9 | Sequences | PASS: definitions and owners. Current values are not captured (A2). |
| 10 | Row counts | PASS: 790 of 790 exact global counts in one REPEATABLE READ snapshot, sealed, opened offline. |
| 11 | Read-only boundary (programme) | PASS: both planes read-only with the read-only session default, ended in ROLLBACK. The privileged statistics counters were unchanged after the 75 s settle. That is a consistency signal, not a complete mutation detector. |
| 12 | Cross-plane consistency (programme) | PASS: table inventory, column structure, relation and policy digests are identical across all three sessions (seven hours apart). No role-visible count exceeds its global count. |
| 13 | Staging unchanged since capture (programme) | PASS: no deploy, forward-upgrade, migration or rollback run since capture. The only control-plane writes since are the catalogue job's own create and delete. Data keeps changing through scheduled jobs, so counts are point-in-time. |
| 14 | 1,000-statement cap (programme) | No limitation: 790 tables, none deferred, 6.8 s of the 45 s budget. Above 1,000 tables, a privileged chain would hit the drift refusal again (A3). |
| 15 | Runtime-plane caveat (programme) | Not limiting. Totals and the ledger come from the single privileged snapshot. Posture is digest-identical across all sessions. |
| 16 | Sufficient for S2.02-LEGACY-GATE (programme) | PASS: the target security function and the guard event trigger, with owners, are present in the preimage. |

## Material blocker

**B1. Installer receipt not observed.**

- **Fix:** PR `fix/ue-s202-installer-receipt` adds one sealed read of `public.ue_v2_bootstrap_receipt` to the privileged plane, under `migration_history`. Evidence without it no longer satisfies that category.
- **Closing it needs:**
  1. that PR merged;
  2. `UE_V2_STAGING_CATALOG_RECIPIENT` re-set to the same founder public key;
  3. one founder-authorized Plane B session with `ue-staging` approval;
  4. offline re-assembly with the existing Plane A runs.
- **Under that PR's contract**, re-assembling the current evidence gives `CATALOG_PARTIAL` (`REQUIRED_EVIDENCE_INCOMPLETE`), and `migration_history` is the only category not accepted.
- **Then:** the founder compares the receipt's source digest with the source-plan digest bound to pin `6a60c95c`, and records the result. A mismatch is evidence for S2.02-REHEARSAL, not a reason to re-run.

## Advisory observations (not blockers)

- **A1.** Extensions, table triggers, functions that are not SECURITY DEFINER, indexes and constraints are outside the frozen contract and were not catalogued. S2.02-REHEARSAL captures its own before-and-after state and must include them.
- **A2.** Current sequence values are not in the preimage. The rehearsal compares sequences within its own before and after.
- **A3.** A privileged multi-session chain on live staging is refused by design while scheduled writers run.
- **A4.** One ledger row's `created_at` differs from its journal `when`, with identical SQL content.
- **A5.** The repository declares 1,224 `pgTable` objects; staging has 790 tables. That is expected for the installed v2 contract, and is input for S2.01-BIND.

## Security housekeeping

| Item | State |
| --- | --- |
| `UE_V2_STAGING_CATALOG_RECIPIENT` | Removed 2026-11-28, after verifying that it equals the founder key. Plane B now refuses before it creates anything. B1 needs it re-set once, then removed again. |
| Founder private key | Kept, mode 0600. It opens the sealed evidence, and the next Plane B session must use the same key. |
| Catalogue jobs | None in staging. |
| `uev2admin` | Exposure rated moderate-low. A controlled rotation plan (dependency inventory, recovery, validation) is in the founder's private evidence folder. Not rotated. Rotate after the B1 session and before S2.02-REHEARSAL. |
| `ue-role-probe2` | A pre-existing manual job from the 2026-11-13 execution. It still holds an administrator credential and is outside S2.02 cleanup ownership. Deletion awaits founder authorization, and precedes rotation. |
| Run artifacts | All seven S2.02 artifacts expire 2026-12-04. In this public repository they are readable by any signed-in GitHub user. The runtime-plane ones hold policy text and role-visible counts in clear. Private copies are verified above. Early deletion is recommended for all seven and awaits founder authorization. |
| Catalogue workflows | Kept on `main`. The runtime plane is read-only, manual and environment-approved, and is needed for any later preimage refresh. The privileged plane is retired by the missing recipient. |

## Next work package

1. Finish S2.02-PREIMAGE by closing B1.
2. Then S2.02-LEGACY-GATE, deciding applicability from this preimage.
3. Lane A's S2.01-INTEGRATE is independent of this work, and waits on founder merge approval of PR #1309.
