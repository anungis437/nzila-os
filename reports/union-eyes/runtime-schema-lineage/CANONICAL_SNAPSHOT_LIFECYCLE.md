# Canonical Snapshot Lifecycle — PASS (with immutability PARTIAL)

**SNAPSHOT_ID / UE_DB_SNAPSHOT_ID:** `staging-canonical-20260923T184938Z-92611387`  
**URI:** `azure://nzilastagingstore/nzila-staging-snapshots/staging-canonical-20260923T184938Z-92611387.dump`  
**schema_digest:** `926113873e8b545a1ae3017e43c303a4d51daabd86b9f530398df8f62a789db7`  
**file_sha256:** `5b67def829412676a33f49d0155949253a76bc7e33efe5334131853cb64783a4`  
**PRODUCTION_TOUCHED:** false

| Step | Outcome |
|---|---|
| RBAC (OIDC/user, no keys) | PASS |
| PUBLISH #1 | PASS |
| VERIFY SHA256 | PASS |
| VERIFY METADATA | PASS |
| VERIFY IMMUTABILITY | **PARTIAL** — versioning + 30d soft-delete; object WORM not available on this Standard_LRS account |
| RETRIEVE by ID | PASS |
| RESTORE empty PG15 | PASS (digest match; only `transaction_timeout` noise) |
| Oracle digest + presence | PASS |
| RLS preflight | PASS 1697/1697 |

**Recommendation:** Align clean-room CI to PostgreSQL 15 (do not silently claim PG16≡PG15).
