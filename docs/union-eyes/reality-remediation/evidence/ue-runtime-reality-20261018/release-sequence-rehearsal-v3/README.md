# Release-sequence rehearsal v3 (final source hardening, 2026-10-19)

**Additional evidence, not staging acceptance.** It supersedes v2 only for the claims listed below and does not alter it: `../release-sequence-rehearsal/` (v1, 41/41 at #948 head `81662c2f9`) and `../release-sequence-rehearsal-v2/` (v2, 60/60 at source `4ad53375a`) stay byte-for-byte as run, each bound to its own SHA.

* One scripted run, **72 checks, 72 passed**, source `f7090fde8e384687fce185d1cf8c9055d204df7b` (= PR #948 head `8cb907d14` + branch `fix/ue-phase3a-schema-compat`, which is **not** a PR), against the exact backend image digest recorded in `results-v3.json` (`meta.backendImage`; the web image digest is recorded, not smoke-tested).
* Everything runs on a loopback-only PostgreSQL 16 container with per-run generated credentials: no staging data, no Azure resource, no staging credential. The single Azure interaction is the registry pull of the candidate backend image before the run (an `az acr login` token, then `docker logout`).

What changed versus v2 (and therefore what v2 no longer says):

| Topic | v2 (60/60) | v3 (72/72) |
|---|---|---|
| `rls-verify` preflight | 1699 checks; recorded as **not** detecting a hand-made permissive policy (E1/E1b "finding") | 1711 checks (1699 + 12 deadline-engine policy-closure checks); the same reopenings are **detected** (E1/E1b assert exit non-zero and the failing check names); the closed state is 1711/1711 (C5, D5, E4, I3, N1) |
| Django guarded columns | coarse type families; unknown types accepted | catalog-based equivalence, unresolved = reject; lineage shape handled explicitly (F2, F7); drifts fail closed (F3, F4, F8, F9) |
| Deadline semantics | one-time backfill assertion | lifecycle guards installed on the lineage-shaped table and enforced (K3, K4); the writers are tested in PGlite in the repository (13 tests), not here |
| R1 read-only check | family heuristic | verdict port driven by the generated field specification; RLS-safe NULL probe; agreement with the real `migrate` (M_xc_*) and a blind-identity case (M_blind) |

Run (Docker required): `pwsh run-rehearsal.ps1 -RepoRoot <checkout at the candidate source> -NodeModules <node_modules> -OutFile results-v3.json [-BackendImage <repo@sha256:...> -FrontendImage <repo@sha256:...>]`. The kit creates and removes its own `node_modules` junction under `-RepoRoot`; never remove a worktree that still contains one with `git worktree remove` (it can follow the junction).

Read the `limits` and `isolation` text in `results-v3.json` literally: they describe the rig (PostgreSQL 16, schema-only, loopback), not staging (PostgreSQL 15, real data, unknown ledger). It is not the restored-clone rehearsal on the deployable digest that the release plan requires.