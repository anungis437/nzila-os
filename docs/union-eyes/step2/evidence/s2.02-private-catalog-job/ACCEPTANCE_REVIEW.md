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

**Recommended decision: accept.** B1 is closed (update of 2026-11-28 below) and every material criterion now passes. `S2.02_PREIMAGE_COMPLETE` stays `NO` until the founder records acceptance. Lifting the staging deployment freeze is not staging release authorization.

## Update 2026-11-28: B1 closed

- Plane B session: run 46136436211, from `main` `30a11767d` (the installer-receipt contract), founder-authorized with `ue-staging` approval. One REPEATABLE READ READ ONLY transaction, observed 11:03:03Z, ended in ROLLBACK. The owned job was deleted and proven absent.
- Offline assembly `preimage-20261128`, from Plane A runs 46036574426 and 46038068694 plus this session: **`CATALOG_COMPLETE`**, every category accepted, 790 of 790 global counts. Private evidence SHA-256 `9774097a0ff94a5bb366ebab30c3e5f398ba8cb6f750f502da2b5aa8c6753f05`. The committed summary is [preimage-20261128/preimage-summary.json](preimage-20261128/preimage-summary.json). It supersedes `preimage-20261127-r2`.
- Installer receipt: one row, observed sealed and opened offline. **Its source digest does not equal the source plan bound to serving pin `6a60c95c` (`6ec71d46…`).** It equals the source plan bound on 2026-11-11 for the Step 1 bootstrap installation (commit `5c6e0b05a` and its predecessors). So the serving application is `6a60c95c`, while the installed v2 database is still at the 2026-11-11 source plan.
- This mismatch is a finding about staging, not a preimage defect, and it is not a reason to re-run. It is the starting state that S2.02-REHEARSAL and S2.02-FORWARD must take into account.
- Staging after the session: same revision at 100% traffic, Healthy. No catalogue job remains. The recipient variable was removed again.

## Evidence reviewed

- Plane A (runtime): runs 46036574426 and 46038068694, from `main` `2927b25ca`.
- Plane B (privileged): run 46136436211, from `main` `30a11767d`, which supersedes run 46084209107 from `main` `445451712`. Each is one REPEATABLE READ transaction.
- Offline assembly `preimage-20261128` (above). The earlier `preimage-20261127-r2`, private evidence SHA-256 `7e326e995dcafb73def9468b2f3e61b0129181818680038d4dd47b20785afbec`, is kept as history. Its committed summary is [preimage-20261127/preimage-summary.json](preimage-20261127/preimage-summary.json).
- Supporting runs: 45940281038, 46019964268, 46048025241 and 46072263185 (refusals and superseded chains). Receipts for all eight runs are in this folder.
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
| 46136436211 | `3c0491ba9e39de18` | `459848ae2aa7b07b` |

## Acceptance criteria

| # | Criterion (frozen contract unless noted) | Result |
| --- | --- | --- |
| 1 | Fresh observation; historical receipts not reused | PASS. All three accepted runs were `workflow_dispatch` from `main` on 2026-11-27. |
| 2 | Names the command, time, revision, traffic weight, image digest and catalogue | PASS. Command: the private catalogue workflow and controller. Times: 16:53:30Z (A) and 23:53:51Z (B). Revision `nzila-ue-v2-staging-app--rel6a60c95c9d`, image `…union-eyes-v2@sha256:2bf18216…`. The controller refuses to create a job unless that revision is Healthy at 100% traffic (`revisionAccepted`), so each accepted run proves 100%. An independent read at about 02:55Z on 2026-11-28 showed the same revision at 100%, Healthy. |
| 3 | Serving-SHA conflict resolved | PASS. Application layer: the serving image is the digest built for pin `6a60c95c`. Database layer: the installer receipt names the 2026-11-11 source plan. The conflict is resolved as a recorded skew between the serving application and the installed database. |
| 4 | PostgreSQL version | PASS: 16.15, identical on both planes. |
| 5 | Migration history / installed migrations | **PASS since 2026-11-28 (B1 closed).** The Drizzle ledger: 40 rows, contiguous, each matching a migration file on `main` byte for byte. That is an older lineage covering 40 of the serving pin's 150 journal entries. The installer receipt, the v2 system of record, is now observed: it names the 2026-11-11 source plan, not the serving pin's. Before 2026-11-28 this criterion was NOT MET, because the receipt was counted but not read. |
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

None open. B1 was closed on 2026-11-28 by run 46136436211 and assembly `preimage-20261128` (update above). The original record follows.

**B1. Installer receipt not observed (closed).**

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
| `UE_V2_STAGING_CATALOG_RECIPIENT` | Removed 2026-11-28 after verifying it equals the founder key. Re-set once, after the key ID was verified, for the B1 session (run 46136436211), then removed again the same day. Plane B now refuses before it creates anything. |
| Founder private key | Kept, mode 0600, in a 0700 folder outside the repository. It opens the sealed evidence. |
| Catalogue jobs | None in staging. Checked after run 46136436211. |
| `uev2admin` | Exposure rated moderate-low. A controlled rotation plan (dependency inventory, recovery, validation) is in the founder's private evidence folder. Not rotated. The B1 session is done, so rotation is unblocked once `ue-role-probe2` is resolved. Rotate before S2.02-REHEARSAL. |
| `ue-role-probe2` | A pre-existing manual job from the 2026-11-13 execution. It still holds an administrator credential and is outside S2.02 cleanup ownership. Deletion awaits founder authorization, and precedes rotation. |
| Run artifacts | Deleted 2026-11-28 on founder authorization, all seven, ahead of their 2026-12-04 expiry. In this public repository they were readable by any signed-in GitHub user, and the runtime-plane ones held policy text and role-visible counts in clear. Each artifact ID now returns 404 and each run lists no artifacts. The verified private copies are now the only copies. The digests in the Integrity table remain checkable against the retained job logs. The B1 run's artifact (46136436211) expires 2026-12-05. It holds only the sealed session and value-free receipts; early deletion awaits founder authorization. |
| Catalogue workflows | Kept on `main`. The runtime plane is read-only, manual and environment-approved, and is needed for any later preimage refresh. The privileged plane is retired by the missing recipient. |

## Next work package

1. Founder records acceptance of S2.02-PREIMAGE (B1 closed; every material criterion passes).
2. Then S2.02-LEGACY-GATE, deciding applicability from `preimage-20261128`.
3. S2.02-REHEARSAL must start from the recorded skew: the installed database is at the 2026-11-11 source plan, and the serving application at pin `6a60c95c`.
4. Lane A's S2.01-INTEGRATE is independent of this work, and waits on founder merge approval of PR #1309.
