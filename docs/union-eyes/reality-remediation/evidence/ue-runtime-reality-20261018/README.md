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
| `harness/` | the scripts that produced the artifacts (secrets are read from the environment, never embedded) |

## SHA-256

| File | SHA-256 |
|---|---|
| `authz-result.json` | `6736854423cb7448166a03b6546cbe2500f4c3003cce8f6ba72f37abc043adcd` |
| `b3-clone-after.json` | `b2c1bddd8be0d04ffc991e063470a69d16a1dae20a5848fbf35c32d0fca21f9c` |
| `b3-clone-before.json` | `0c697b4879ae8c9a5f5b9fd3dab03437c5cad109b3b48ee1cc01a310373494a6` |
| `b3-clone-rolledback.json` | `2449f6f043f3b3bd8bf8d6287363ea46dd83c777212de32c34111b60ca310a53` |
| `harness/authz.js` | `be083048f8299e50740f21243eedea1c92d086770c467875c4ef715d8d168124` |
| `harness/b3.js` | `fa47dc5c874fdedb5df1f32183ee2bd98ebfac702191d100c3a1649b70d98b70` |
| `harness/clone-schema-patch.js` | `0bf07785fde14487ad4be5add9fef2d5ecb21c5a4a4c81af7a5ccfe4c9c0d493` |
| `harness/introspect.js` | `e651df7b33815b8372bed2cd3aab4eae126c3df58ace676c0dbcce39ce56047e` |
| `harness/nav-canonical-routes.json` | `6fd4a41c2ca48d1b3115a1d2b7fb4cbbbe2cdfd36cc770c32eba08ad3951c76e` |
| `harness/routes.js` | `21760caa661b36b7efe38668ccf498300b66d40cc8587f4371f8539243a06357` |
| `harness/worker-harness.ts` | `8b850f235136e9c3c377a23560694cc628e1984872ae6df677bf783d9680a02e` |
| `kql-set.json` | `476e7ef00a923f58e49281b4e1467d211b685422463e08f06f8102b88745cce1` |
| `rls-verify-preflight-clone-after.txt` | `7e179bb32bc46cbe2ecf249463bea95890dbcd67c7301b7c52a7ad483f176ae7` |
| `rls-verify-preflight-staging.txt` | `82139c80a8fdb67cbc8604c45388a5fb92f53b9180f8270e3eb5fb2ddeb29de6` |
| `routes-result.json` | `217d383482a8e9dfbd0e1617e5070786e01684f21dba6caa426ff20e4fee5eb3` |
| `worker-live-schema.json` | `8aef425c0e7aba8460cc8f2aaf5638f6b326651b4027e5f033fb88acf304dd54` |
| `worker-patched-clone.json` | `ed374b7b245c33ca8f1b58249997c63de0e7226a534e45e28fc6d00c305fc9af` |
