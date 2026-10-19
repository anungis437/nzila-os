# Release-sequence rehearsal v4 (predicate contract and required-table mode, 2026-10-19)

**Additional evidence, not staging acceptance.** It supersedes v3 only for the claims below and changes nothing already committed: v1 (41/41, #948 `81662c2f9`), v2 (60/60, `4ad53375a`) and v3 (72/72, `f7090fde8`) remain byte-for-byte as run, each bound to its own SHA.

* One scripted run, **76 checks, 76 passed**, source `db554638a6e3b69378550df7f524df097701689b` (= PR #948 head `e962cde63` + branch `fix/ue-phase3a-schema-compat`, now PR #967), against the exact backend image digest in `results-v4.json` (`meta.backendImage`; the web image digest is recorded, not smoke-tested).
* Loopback-only PostgreSQL 16 container, per-run generated credentials, no staging data, no Azure resource. The single Azure interaction is the registry pull of the candidate backend image before the run (an `az acr login` token, then `docker logout`).

New versus v3 (the 72 v3 checks are carried over unchanged):

| Check | Claim, on the real `rls-verify` CLI |
|---|---|
| P0 | closed state: preflight 1711/1711 and isolation probe 15/15 |
| P1 | identity comparison + nonempty context (a widening that satisfied the old structural rules): the isolation probe **leaks** and the preflight **fails** naming the approved-predicate contract |
| P2 | inequality (other tenants only) is also rejected |
| P3 | an absent deadline table: default mode reports NOT_PRESENT without failing; with `--require-deadline-engine-tables` (the deploy preflight) all 4 of its checks fail |

What this does **not** claim: the predicate check is an exact textual contract (identical catalog text on PostgreSQL 15, 16 and 18), not general semantic verification; the exhaustive widening matrix and the cross-tenant read/update/delete/insert proofs live in `apps/union-eyes/scripts/__tests__/rls-verify-deadline-engine-policies.pglite.test.ts`. The rig is PostgreSQL 16, schema-only, loopback; staging is PostgreSQL 15 with real data and an unknown ledger; this is not the restored-clone rehearsal on a deployable digest.

Run (Docker required): `pwsh run-rehearsal.ps1 -RepoRoot <checkout at the candidate source> -NodeModules <node_modules> -OutFile results-v4.json [-BackendImage <repo@sha256:...> -FrontendImage <repo@sha256:...>]`. The kit creates and removes its own `node_modules` junction under `-RepoRoot`. Never remove a worktree that may still contain a junction with `git worktree remove --force` (it follows junctions); use `tooling/scripts/safe-remove-worktree.mjs` (PR #966).