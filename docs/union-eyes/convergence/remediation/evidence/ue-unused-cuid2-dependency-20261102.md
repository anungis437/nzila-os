# Union Eyes — unused direct dependency removal (2026-11-02)

**Source baseline:** `d9b05e884af38f64d172c7d123b4678e826f8cea`  
**Source correction:** `43e6c83ab7f2e921d790d0b450e4b1b1d10b3c77`

The exact-baseline whole-contract run at `bf62586b8baa1ddcf418c97be9dff53f40a7502e` found that `apps/union-eyes/package.json` declared `@paralleldrive/cuid2@^3.3.0` as a production dependency, but no Union Eyes source imported it. Removed the unused direct dependency, its `apps/union-eyes` importer record, and the unused 3.3.0 package/snapshot from `pnpm-lock.yaml`. The **2.3.1 transitive dependency required by formidable is retained**, as are its resolution and snapshot. No runtime import was introduced merely to appease the contract test. The change does not modify financial, identity, tenant or privacy authorization.

**Evidence:** Exact source-commit diff and lockfile content. The pre-change contract failure is in GitHub Actions workflow run 41394800020 (whole-contract job 125114111167). Fresh exact-SHA `pnpm install --frozen-lockfile` and complete contract/Vitest, native PostgreSQL 15/16, HTTP/browser and staging evidence remain pending; this entry does not claim a pass. Separate route-coverage manifest drift remains unresolved.

**Defect credit: 0. Closure credit: 0.** Frozen 777-defect provenance and institutional approvals remain unchanged.
