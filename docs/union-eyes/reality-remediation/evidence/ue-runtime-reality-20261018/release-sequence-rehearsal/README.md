# Release-sequence rehearsal for migration 0015

**Purpose.** Verify, on a disposable local database, the release order, failure behavior and recovery behavior of
`apps/union-eyes/db/migrations-cache/0015_deadline_engine_rls_fail_closed_closure.sql` (PR #948, CHG-2026-0112) before any
staging change is proposed. Discussed in dossier sections 14.2 and 18.

**Status.** Additional evidence, gathered **after** and kept separate from the original staging observations in the parent
folder. It touches no Azure resource and no staging data and uses no credential. It does **not** replace the restored-clone
rehearsal on the exact candidate digest.

## Result

[`results.json`](./results.json): **41 checks, 41 passed**, from one scripted run against PR #948 head
`81662c2f9da28a2056ff7bf3a4e72607cbede0ab` (`0015` sha256 `40006a7258f74ee58d6d5fe9ff55871c96268abef4ceb6c8724aa429c0ded7f6`,
LF-normalized). Groups: `SETUP`, `FIDELITY` (rig matches staging), `A_CONTROL`, `B_CHECK`, `C_APPLY`, `D_ATOMIC`,
`E_RECOVERY`, `F_DJANGO`, `G_CANDIDATE_WORKER`, `H_SERVING_IMAGE`, `I_FRESH`.

## How to run

Requires Docker, git, Node (+ a `node_modules` directory with the repository's dependencies), and Python with the backend
requirements (Django). From any shell:

```powershell
pwsh -File run-rehearsal.ps1 -RepoRoot <checkout of the candidate source> -NodeModules <path to node_modules> -OutFile results.json
```

The script starts a loopback-only `pgvector/pgvector:0.8.1-pg16` container with **per-run generated credentials**, builds a
staging-shaped schema by running the clean-room lineage at the deployed commit (`eae195f2`, in a temporary sparse worktree),
asserts fidelity against facts observed on staging, runs the scenarios, and removes the container, the temporary worktrees and
the `node_modules` junction it created. No password is stored in any file; connection strings are built at runtime.

## Limits (read before relying on it)

* PostgreSQL 16 in Docker, schema only. Staging is Azure PostgreSQL 15 with real data and an **unknown** migration ledger.
* The staging-shaped state is reproduced and validated against observed facts; it was not read from staging.
* The Django finding (group F) applies to staging only if the columns listed in `results.json` exist there (dossier 14.3, query 5).
* Azure steps (revision deactivation, labels, traffic, rollback weights) are not rehearsed.
* Any future test against a non-loopback database must use `../harness-v2/pg-tls.js` (verified TLS). The helpers here refuse
  non-loopback targets by construction.