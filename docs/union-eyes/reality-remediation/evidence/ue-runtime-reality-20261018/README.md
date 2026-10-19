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

## SHA-256

SHA-256 of each file's committed (LF-normalized) content, i.e. what a fresh checkout contains. Correction note (2026-10-19): the first revision of this manifest hashed 11 files from the Windows working copy (CRLF) or an earlier copy, so those rows did not match the committed content (6 other rows did). No artifact content changed - the artifacts are byte-identical to the first commit (`35792b991`) - only the manifest was recomputed. The files under `harness-v2/` and `schema-insert-semantics-inventory.json` were added later.

| File | SHA-256 |
|---|---|
| `authz-result.json` | `6736854423cb7448166a03b6546cbe2500f4c3003cce8f6ba72f37abc043adcd` |
| `b3-clone-after.json` | `b2c1bddd8be0d04ffc991e063470a69d16a1dae20a5848fbf35c32d0fca21f9c` |
| `b3-clone-before.json` | `0c697b4879ae8c9a5f5b9fd3dab03437c5cad109b3b48ee1cc01a310373494a6` |
| `b3-clone-rolledback.json` | `2449f6f043f3b3bd8bf8d6287363ea46dd83c777212de32c34111b60ca310a53` |
| `harness-v2/insert-semantics-inventory.js` | `2e16dc4e1b789d70693183668f346fc5ece7d1be9d93604cfe28c50a312463d6` |
| `harness-v2/pg-tls.js` | `0ab5a7b781d2fc81da77445a6bab82fc83229f0bf360142591aa9603aebf3fa8` |
| `harness-v2/pg-tls.selftest.js` | `2bb859529450a417e379cf57c231bfd7bdb25ec1b7e79863ee1cab9d70bd37a8` |
| `harness/authz.js` | `bd8e973984eb05a1db173abb4de44626abc3b2262a7c45144ed2085b9f45e3b5` |
| `harness/b3.js` | `8a1c7319f2f1dc4b08ed7433a9227622d02d5ea610768a21522cda7e5f84ae81` |
| `harness/clone-schema-patch.js` | `ae5d77a77fbd87ddfdea1ecc1961d1c1694106a10ed13127e43422fae3f0a555` |
| `harness/introspect.js` | `482a02d6f7509dfcb3e4734806ef39620054a6bc206162a23d2f200d3a32167e` |
| `harness/nav-canonical-routes.json` | `31323eb1d6e2c10ee33f01c5160a3ac35c5bd785fbf53be1e1365bbc3c8903c5` |
| `harness/routes.js` | `bfd72d80a571c4f08c6d1097edc91b33c071607671e79bd2695a9201a778a5a4` |
| `harness/worker-harness.ts` | `d9238136146ccd674d92d33207c8fff5b52e0dc64bc36aee121a5fe64e535af7` |
| `kql-set.json` | `73957eb2f8edcce420e89a0d6807520dc93de27c74a6a2d575f7959733184996` |
| `rls-verify-preflight-clone-after.txt` | `89b16563c99793d7c767ed2919c1cb4c6035a5c92c2291908554178a9a529970` |
| `rls-verify-preflight-staging.txt` | `56147ba401d80d90df68a918ddec7fe1acda5c682cb3d00b54b60890b968b061` |
| `routes-result.json` | `217d383482a8e9dfbd0e1617e5070786e01684f21dba6caa426ff20e4fee5eb3` |
| `schema-insert-semantics-inventory.json` | `589590fa09bce52907896ba74a705bcc025ecafa967440547a0ab2d0b05d5b8d` |
| `worker-live-schema.json` | `53b315e568f183bf7f497dd1028f4ed2cddf410e80da556154bb4f077d2c0a00` |
| `worker-patched-clone.json` | `ed374b7b245c33ca8f1b58249997c63de0e7226a534e45e28fc6d00c305fc9af` |
