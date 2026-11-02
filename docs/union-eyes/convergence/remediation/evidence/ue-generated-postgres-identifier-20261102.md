# Union Eyes — generated PostgreSQL constraint identifier integrity (2026-11-02)

**Source baseline:** `bf62586b8baa1ddcf418c97be9dff53f40a7502e`  
**Source correction:** `8b52e630c8a4cd1c83f3e9e7196660d5d900c2a2`  
**Scope:** Future generated unique-constraint migration identifiers and the converged-schema census regression. Existing migration SQL and frozen qualification artifacts are unchanged.

## Source finding and correction

The declared-convergence generator shortened PostgreSQL identifiers by JavaScript string length and used an eight-hex-character SHA-1 suffix. PostgreSQL enforces a **63-byte UTF-8** identifier limit; character-based truncation could silently collide on multibyte identifiers, while the short legacy digest had weak collision resistance. The generator now calls `fitPostgresIdentifier`, which uses UTF-8 byte-aware prefix truncation and a deterministic 16-hex-character SHA-256 suffix for names exceeding 63 bytes. This is identifier disambiguation, not a password hash or an authorization mechanism. Existing migrations are not rewritten, and no live constraints are renamed.

A four-case adversarial Vitest suite covers exact-limit preservation, deterministic 63-byte output, distinct long names sharing a prefix, and multibyte Unicode. The schema-live-unreferenced regression now asserts that the post-convergence **missing-physical-relation census is empty**, while separately requiring the eight kept declarations to remain in the Drizzle barrel and the five intentionally removed declarations to stay absent. No database table or policy is dropped.

## Verification and disposition

Source files and test file were read back at the exact source commit. Tests were **authored, not executed or qualified by this evidence**. The preceding baseline `bf62586b8baa1ddcf418c97be9dff53f40a7502e` failed whole-contract tests on the SHA-1 generator and an unrelated unused dependency, and failed whole-application tests on a stale census assertion and route coverage manifest drift. The source correction addresses the generator and census findings; it does **not** claim the unused dependency or route manifest has been repaired. Fresh exact-SHA full Vitest/contract, native PostgreSQL 15/16, HTTP/browser and staging evidence remain required. No independent release approval or defect CLOSED credit is claimed.

**Defect credit: 0. Closure credit: 0.** The frozen 777-defect register, 150-item index and 111-capability provenance are preserved.
