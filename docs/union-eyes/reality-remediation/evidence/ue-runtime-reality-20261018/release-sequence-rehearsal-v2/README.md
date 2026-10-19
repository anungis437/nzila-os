# Release-sequence rehearsal v2 (candidate qualification, 2026-10-19)

**Additional evidence, not staging acceptance.** It extends the v1 kit (`../release-sequence-rehearsal/`, 41/41 at #948 head `81662c2f9`, unchanged) and never touches Azure, a staging database or a staging credential: everything runs against a loopback-only PostgreSQL 16 container with per-run generated credentials. When `-BackendImage` is supplied, the digest-pinned candidate backend image is pulled beforehand from the build registry (an `az acr login` token, then `docker logout`); that pull is the only Azure interaction and the rehearsal itself does not use it.

* `run-rehearsal.ps1` — the scripted run (setup, fidelity, governed executor, atomicity, recovery detection, Django qualification, profiles/deadline corrections, candidate worker, candidate image, R1 cases, timed sequence).
* `helpers/r1-readonly-check.js` — the read-only catalog/ledger check intended for a **trusted** runner against staging (`R1_DATABASE_URL` in the environment, `BEGIN READ ONLY`, verified TLS, exit 0 PROCEED / 2 STOP). It was validated here only against rig databases.
* `results-v2.json` — output of one run: 60 checks, 60 passed, source `4ad53375a`, backend image `…-backend@sha256:30e2e3a1…92d8`.

Differences from v1: no recovery file exists (the v1 recovery-file checks are replaced by detection and re-close checks), the worker runs on the Django-migrated schema (only the convergence table is a synthetic patch), and the candidate Django migrations, the profiles/deadline corrections, the candidate image and the R1 STOP cases are covered. Read the "as run" `limits` and `isolation` text in the results literally: they describe the rig; the image pull above is the one exception.

Run (Docker required): `pwsh run-rehearsal.ps1 -RepoRoot <checkout at the candidate> -NodeModules <node_modules> -OutFile results-v2.json [-BackendImage <repo@sha256:…>]`.