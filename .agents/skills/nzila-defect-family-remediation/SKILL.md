---
name: nzila-defect-family-remediation
description: Use for Union Eyes Gate 0 or other large defect registers when many findings share root causes. Cluster by permanent fix, remediate complete families in bounded batches, and reconcile every register row to evidence.
---

# Defect-family remediation

## Trigger
Use when asked to drive down a numbered defect register, especially when the user requests grouping by correction rather than one ticket at a time.

## Procedure
1. Establish the live branch, register location, schema, initial item count, unique defect IDs, open/closed semantics, and exact baseline SHA. Do not substitute an earlier count, a guessed register path, or CI warnings for the actual register.
2. Read relevant `AGENTS.md` policy and product/route contracts. Build a family matrix keyed by one real root-cause correction: `family`, `affected_ids`, `owner/code_paths`, `invariant`, `fix_pattern`, `exceptions`, `evidence`.
3. Prioritize high-leverage shared fixes. Find all affected call sites, entry points, tenant scopes, error paths, and user journeys before changing the shared implementation. Preserve API and authorization contracts.
4. Implement the complete family, including negative cases and migration/rollback consequences if applicable. Do not replace a defect with a suppression, stub, fake UI success, empty-success API, or unverified claim.
5. Reconcile each member ID against code: `FIXED_IN_SOURCE` requires a traceable code change and reproducible targeted evidence; `UNRESOLVED` and `BLOCKED_RUNTIME` remain separate. Never silently delete defects, fabricate closure, or lower the denominator.
6. Recount directly from the authoritative register; report `baseline`, `corrected`, `remaining`, `unclassified`, and branch/commit. Keep implementation progress separate from runtime acceptance and release GO.
7. After the planned source-fix families are complete, run the repository's prescribed review checks before requesting review. An early targeted unit test may be used when necessary to avoid an unsafe fix; do not spend the defect-remediation phase on unrelated CI refactors.

## Stop conditions
Stop a family only when every ID is mapped to an implemented correction or a specific unresolved exception. A source fix never alone proves staging, tenant isolation, payment correctness, or production release eligibility.

