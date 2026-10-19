# UE-RUNTIME-REALITY-20261018 — evidence artifacts

Sanitized evidence referenced by [29_UE_PHASE3A_RUNTIME_REALITY_DOSSIER.md](../../29_UE_PHASE3A_RUNTIME_REALITY_DOSSIER.md).
No secret value, connection string, session token or member record is present. Staging received read-only
catalog queries and synthetic-identity HTTP requests only; every fixture write, the closure migration, its rollback
and the worker schema patch were applied to a disposable point-in-time restore clone that has since been deleted.

| Artifact | What it is |
|---|---|
| `rls-verify-preflight-staging.txt` | trimmed `rls-verify --mode=preflight` against staging as `union_eyes_runtime` (1698/1699) |
| `rls-verify-preflight-clone-after.txt` | same, on the clone after the closure (1699/1699) |
| `b3-clone-before.json` / `b3-clone-after.json` / `b3-clone-rolledback.json` | tenant-isolation harness on the clone: before (30/35), after (38/38), after rollback (31/38) |
| `worker-live-schema.json` | worker run against the live staging schema shape (fails: missing table and columns) |
| `worker-patched-clone.json` | worker claim/lease primitives on a clone carrying a clone-only synthetic schema patch (9/9) — supporting evidence, not staging proof |
| `authz-result.json` | HTTP authorization negative controls against staging with synthetic acceptance identities |
| `routes-result.json` | persona route matrix (47 entries) against staging, with and without a synthetic token |
| `kql-set.json` | operational query set executed against the real Log Analytics workspace |
| `harness/` | the scripts that produced the artifacts **as run** (secrets read from the environment, never embedded). They connected with TLS verification disabled; preserved unchanged as evidence and must not be reused (dossier section 15) |
| `harness-v2/pg-tls.js`, `pg-tls.selftest.js` | corrected verified-TLS PostgreSQL connection factory and its credential-free self-test (added 2026-10-19; not used to produce the artifacts above) |
| `harness-v2/insert-semantics-inventory.js` + `schema-insert-semantics-inventory.json` | static, credential-free upper bound of Django-owned tables with Drizzle insert sites (267), replacing the blunt 523-column figure as a work-planning input (added 2026-10-19; pinned to the commit recorded inside the JSON) |
| `release-sequence-rehearsal/` | **added 2026-10-19, after the original evidence**: reproducible loopback rehearsal of the 0015 release order, atomic failure, recovery and fresh bootstrap (41 checks, 41 passed) with its orchestrator, helpers and `results.json`; touches no Azure resource, staging data or credential (see its README) |

## SHA-256

SHA-256 of each file's committed (LF-normalized) content, i.e. what a fresh checkout contains. Correction note (2026-10-19): the first revision of this manifest hashed 11 files from the Windows working copy (CRLF) or an earlier copy, so those rows did not match the committed content (6 other rows did). No result artifact changed (all are byte-identical to the first commit `35792b991`). One as-run script, `harness/b3.js`, received a semantic-preserving edit to satisfy CodeQL `js/identity-replacement`: a no-op `sql.replace('$1', '$1')` was removed (it returned its input unchanged, so the results are unaffected). Its as-run committed content had sha256 `8a1c7319f2f1dc4b08ed7433a9227622d02d5ea610768a21522cda7e5f84ae81` (git blob at `35792b991`). The manifest was recomputed accordingly. The files under `harness-v2/` and `schema-insert-semantics-inventory.json` were added later.

| File | SHA-256 |
|---|---|
| `authz-result.json` | `6736854423cb7448166a03b6546cbe2500f4c3003cce8f6ba72f37abc043adcd` |
| `b3-clone-after.json` | `b2c1bddd8be0d04ffc991e063470a69d16a1dae20a5848fbf35c32d0fca21f9c` |
| `b3-clone-before.json` | `0c697b4879ae8c9a5f5b9fd3dab03437c5cad109b3b48ee1cc01a310373494a6` |
| `b3-clone-rolledback.json` | `2449f6f043f3b3bd8bf8d6287363ea46dd83c777212de32c34111b60ca310a53` |
| `harness-v2/insert-semantics-inventory.js` | `2e16dc4e1b789d70693183668f346fc5ece7d1be9d93604cfe28c50a312463d6` |
| `harness-v2/pg-tls.js` | `0ab5a7b781d2fc81da77445a6bab82fc83229f0bf360142591aa9603aebf3fa8` |
| `harness-v2/pg-tls.selftest.js` | `073a5b7eadfa553d7909d2091328779379c70182da0c90d1956ed86a4ca48526` |
| `harness/authz.js` | `bd8e973984eb05a1db173abb4de44626abc3b2262a7c45144ed2085b9f45e3b5` |
| `harness/b3.js` | `287be35a58d9b817552f0e0013f1601fbd5fba871d532c78445d9e4de485877a` |
| `harness/clone-schema-patch.js` | `ae5d77a77fbd87ddfdea1ecc1961d1c1694106a10ed13127e43422fae3f0a555` |
| `harness/introspect.js` | `482a02d6f7509dfcb3e4734806ef39620054a6bc206162a23d2f200d3a32167e` |
| `harness/nav-canonical-routes.json` | `31323eb1d6e2c10ee33f01c5160a3ac35c5bd785fbf53be1e1365bbc3c8903c5` |
| `harness/routes.js` | `bfd72d80a571c4f08c6d1097edc91b33c071607671e79bd2695a9201a778a5a4` |
| `harness/worker-harness.ts` | `d9238136146ccd674d92d33207c8fff5b52e0dc64bc36aee121a5fe64e535af7` |
| `kql-set.json` | `73957eb2f8edcce420e89a0d6807520dc93de27c74a6a2d575f7959733184996` |
| `release-sequence-rehearsal/README.md` | `910f424f4bbf67420eb15c949b0571c9e288ec03a959e60958ed5c35d66f3797` |
| `release-sequence-rehearsal/helpers/isolation-probe.js` | `77571176ffdcf100256bdd00de3ad31ecdb740a62a78212627b33587dcde0422` |
| `release-sequence-rehearsal/helpers/loopback-schema-patch.js` | `f26ef7d32d2c3a18bf5fe1a7a935d54e9dedc2b52fd1502fb84ab63d87f92f16` |
| `release-sequence-rehearsal/helpers/migration-columns.js` | `2837cd77656e09267e056faa7d28d1abe9ea7618e50db8230aeca6259eaedbf3` |
| `release-sequence-rehearsal/helpers/rehearse.js` | `2b6fb685f06605ba0f5ad11c27e8dfe8e5012cf30f228338dc2b1eeda0fcc5d4` |
| `release-sequence-rehearsal/helpers/worker-harness.ts` | `4c35f66a3c88e54955669cdb911631fb876813a3a6d41a882e5e9c9459cc2398` |
| `release-sequence-rehearsal/results.json` | `34c5290e6302ae12571a8f74af7844be33f2a5caaaa707a60377f403ec44f75f` |
| `release-sequence-rehearsal/run-rehearsal.ps1` | `3013e0e53024ca460346b588cd693ee26b6a9485a5d9b4ef09b8a35251fb83b5` |
| `rls-verify-preflight-clone-after.txt` | `89b16563c99793d7c767ed2919c1cb4c6035a5c92c2291908554178a9a529970` |
| `rls-verify-preflight-staging.txt` | `56147ba401d80d90df68a918ddec7fe1acda5c682cb3d00b54b60890b968b061` |
| `routes-result.json` | `217d383482a8e9dfbd0e1617e5070786e01684f21dba6caa426ff20e4fee5eb3` |
| `schema-insert-semantics-inventory.json` | `589590fa09bce52907896ba74a705bcc025ecafa967440547a0ab2d0b05d5b8d` |
| `worker-live-schema.json` | `53b315e568f183bf7f497dd1028f4ed2cddf410e80da556154bb4f077d2c0a00` |
| `worker-patched-clone.json` | `ed374b7b245c33ca8f1b58249997c63de0e7226a534e45e28fc6d00c305fc9af` |
