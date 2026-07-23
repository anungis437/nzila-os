# Phase 0B.1 — Per-Commit Disposition Audit

**Working branch (historical record):** `fix/union-eyes-reality-remediation`  
**Pre-Phase-0B checkpoint (basis for clean branch):** `4d6f63511` — "Phase 0A.1: closure docs + phase ledger amendment (GREEN)"  
**Clean branch:** `fix/union-eyes-phase0b-clean` (created from `4d6f63511`; worktree `../nzila-automation-phase0b-clean`)  

Per Aubert's Phase 0B.1 mandate, every path in every Phase 0B commit is
classified below. The clean branch reapplies only those paths whose retention
is directly required for Phase 0B and whose change is the narrowest valid
correction.

Classification codes:

- **Direct** — genuine Phase 0B semantic content (organization contract, KPI ID
  system, migration 0038, resolver, evidence).
- **Supporting** — narrowly required by a Direct change (unit tests for a
  Direct file, migration companion, config change specific to a Direct file).
- **Unrelated** — repo-wide sweep, unrelated app work, generated artifact,
  cosmetic drift.
- **Generated** — machine-produced from other Direct/Supporting content.

Retention criterion (verbatim from Aubert's mandate):

> A change is retained on the clean branch only if it is directly required to
> test Phase 0B code AND the original configuration demonstrably prevents that
> Phase 0B test from running correctly AND the change is the narrowest valid
> correction.

## Commit inventories

Per-commit file lists (verbatim `git show --name-only`) are stored beside this
document as `commit-<sha>-files.txt`.

## 1. `1e5a6bd94` — repo-wide vitest.config.ts sweep (255 files)

**Purpose (claimed):** Stabilize vitest timeouts across the monorepo.  
**Composition:** 248 `vitest.config.ts` files (one per package) + 1 audit
script (`scripts/audit/bump-vitest-timeouts.ps1`) + 6 individual test files.  
**Reach:** ~250 packages across `apps/`, `packages/`, `platform/`,
`services/`, `tooling/`, `infrastructure/`, `security/`, `governance/`,
`ops/`, `content/`, `templates/`, `docs/`, `fixtures/`.  

| Path pattern | Count | Phase 0B relevance | Keep on clean branch | Reason |
| --- | ---: | --- | --- | --- |
| `apps/**/vitest.config.ts` | 24 | Unrelated | ❌ No | Repo-wide sweep. No Phase 0B code lives in most of these apps. |
| `packages/**/vitest.config.ts` | ~148 | Unrelated | ❌ No | Repo-wide sweep. |
| `platform/**/vitest.config.ts` | ~28 | Unrelated | ❌ No | Repo-wide sweep. |
| `services/**/vitest.config.ts` | ~10 | Unrelated | ❌ No | Repo-wide sweep. |
| `tooling/**/vitest.config.ts` | ~10 | Unrelated | ❌ No | Repo-wide sweep. |
| Other `vitest.config.ts` | remainder | Unrelated | ❌ No | Repo-wide sweep. |
| `scripts/audit/bump-vitest-timeouts.ps1` | 1 | Unrelated | ❌ No | Ancillary to the sweep, not to Phase 0B semantics. |
| `apps/abr/.../ReviewerActions.test.tsx` | 1 | Unrelated | ❌ No | ABR app; no Phase 0B dependency. |
| `apps/flow/.../barrels-and-telemetry-slice.test.ts` | 1 | Unrelated | ❌ No | Flow app; no Phase 0B dependency. |
| `apps/flow/.../control-handler-registration-smoke.test.ts` | 1 | Unrelated | ❌ No | Flow app; no Phase 0B dependency. |
| `apps/mobility-client-portal/.../marketing-vocabulary.test.ts` | 1 | Unrelated | ❌ No | Mobility app; no Phase 0B dependency. |
| `packages/db/src/__tests__/runtime.test.ts` | 1 | Supporting-candidate | 🔎 Inspect on clean branch | `packages/db` is Phase 0B's home; verify the change is the narrowest correction required by migration 0038 tests. If not, drop. |
| `apps/orchestrator-api/.../ready.test.ts` | 1 | Unrelated | ❌ No | Orchestrator readiness probe; not Phase 0B. |

**Disposition:** The commit is a legitimate but separate concern — a
test-infrastructure stabilization sweep. It must not travel on the Phase 0B
clean branch. It is preserved on `fix/union-eyes-reality-remediation` as a
historical record and will be re-landed on a future
`chore/test-infrastructure-stabilization` branch after Phase 0B.1 closes.  

**Do not** cherry-pick this commit onto the clean branch. If, during clean-
branch validation, a Phase 0B test genuinely cannot run without a per-package
vitest timeout increase, add only that package's `vitest.config.ts` change as
a narrow supporting change in the same clean-branch commit as the test.

## 2. `511c9c1cb` — Phase 0B core evidence + migration 0038 (3 files)

**Purpose:** Establishes Outcome C (organization contract) and adds
DB-level integrity migration `0038`.  

| Path | Change purpose | Phase 0B relevance | Keep on clean branch | Reason |
| --- | --- | --- | --- | --- |
| `packages/db/drizzle/0038_phase_0b_organization_and_kpi_integrity.sql` | Adds FK `organizations.platform_tenant_id → organizations.id`, `CHECK organizations_platform_tenant_id_equals_id`, partial index, `drizzle.__phase0b_outcomes` marker table with allowed outcome-class CHECK. Wraps DDL in `IF NOT EXISTS` / conditional `DO $$` blocks so it can no-op if application schema absent. | **Direct** | ✅ Yes | Core Phase 0B DDL. Verified false-success-prevention against clean DB probe `nzila_phase0b_probe_v4`. |
| `reports/audits/cupe-national-phase-0/organization-model-decision.md` | Records Outcome C selection and rationale. | **Direct** | ✅ Yes (after Phase 0B.1 corrections applied — see Step 5) | Verify all wording is consistent with the final architecture decision. |
| `reports/audits/cupe-national-phase-0/organization-model-dependency-map.md` | Maps organization-shaped tables + FK references. | **Direct** | ✅ Yes | Foundation for lineage discussion. |

**Disposition:** Retain all 3. Before recommitting on the clean branch,
re-read the SQL to confirm: (a) outcome-class values are exactly
`'applied'` / `'deferred-app-schema-absent'`; (b) no `CREATE TABLE`
without `IF NOT EXISTS`; (c) no destructive DDL; (d) references only to
`organizations` (not the ambiguous `orgs` unless intentional per the final
architecture decision).

## 3. `c40a3e33a` — Platform-tenant resolver + unit tests (2 files)

| Path | Change purpose | Phase 0B relevance | Keep on clean branch | Reason |
| --- | --- | --- | --- | --- |
| `apps/union-eyes/lib/organizations/platform-tenant.ts` | Resolves `orgs.id` for a given Django `organization_id` via `platform_tenant_id`. Fail-closed on ambiguity. | **Direct** | ✅ Yes | Core Phase 0B resolver. |
| `apps/union-eyes/lib/__tests__/platform-tenant.test.ts` | 10 unit tests (happy path, absent mapping, ambiguous mapping, fail-closed contract). | **Supporting** | ✅ Yes | Narrowly required to test the Direct file above. |

**Retention gap flagged by mandate:**

> Do not retain a resolver as "implemented" if no real baseline service uses it.

The clean branch must add a **production integration commit** wiring
`getPlatformTenantId(...)` into at least one Union Eyes API route or
data-access layer before Phase 0B can be declared complete. See
`organization-resolver-integration-proof.md` for the inventory of call sites
that need to be updated.

## 4. `896a18e0c` — UE Cognition KPI schema (1 file)

| Path | Change purpose | Phase 0B relevance | Keep on clean branch | Reason |
| --- | --- | --- | --- | --- |
| `packages/ue-cognition/src/schema.ts` | Changes 6 KPI-related tables from `uuid` PK to `text` PK to permit human-readable prefixed IDs (`KPI-*`, `PLB-*`, etc.). | **Direct (incomplete)** | ✅ Yes (only paired with a DB migration) | TypeScript schema now disagrees with any existing DB where those columns are `uuid`. |

**Retention gap flagged by mandate:**

> Do not retain a TypeScript schema that disagrees with existing database
> columns unless a migration in the same clean branch corrects the database.

The clean branch must add a **companion Drizzle SQL migration** in the same
commit (or an adjacent commit landed together) that either:

- alters the 6 affected columns from `uuid` to `text` (with data migration
  strategy if any environment already holds `uuid` values); **or**
- documents that the affected environments contain no rows (empty tables) so
  a `TRUNCATE` + `ALTER TYPE` is safe.

See `kpi-database-migration-proof.md` for the table×column matrix + the
proposed migration skeleton.

## 5. `7a1c90ab3` — Evidence + docs bundle (112 files, staged via `git add -A`)

**Purpose (claimed):** Land Phase 0B evidence artifacts + governance report
refresh + doc updates.  
**Composition (top-level count):** 57 `reports/`, 48 `docs/`, 5 `ops/`,
1 `.gitignore`, 1 `apps/`.  

| Path pattern | Count | Phase 0B relevance | Keep on clean branch | Reason |
| --- | ---: | --- | --- | --- |
| `reports/audits/cupe-national-phase-0/**` | 44 | **Direct** for Phase 0B evidence subset | ✅ Yes (audited subset) | Phase 0B evidence documents and logs. Filter to only Phase 0B artefacts — omit already-generated reports from prior phases if they were merely regenerated. |
| `reports/*.md` / `reports/*.json` (governance) | ~10 | **Generated** | ❌ No | These are auto-produced by `pnpm validate:docs` / `pnpm governance:audit`. Regenerate on clean branch by running the commands; do not carry stale copies. |
| `docs/institutional-engineering/**` | 39 | **Unrelated** | ❌ No | These are separate governance content updates. They belong on their own branch. |
| `docs/nzila/**` | 6 | **Unrelated** | ❌ No | Separate content updates. |
| `docs/ops/**` | 2 | **Generated** | ❌ No | Regenerated by governance tooling. |
| `docs/documentation-index.md` | 1 | **Generated** | ❌ No | Regenerated by `pnpm validate:docs`. |
| `ops/outputs/**` | 4 | **Generated** | ❌ No | Governance tool outputs. |
| `ops/ue-cognition/**` | 1 | 🔎 Inspect on clean branch | Maybe | Only include if directly tied to Phase 0B KPI DB migration proof. |
| `.gitignore` | 1 | **Supporting** | ✅ Yes | Allowlists Phase 0B log paths. |
| `apps/union-eyes/next-env.d.ts` | 1 | **Generated (Next.js)** | ❌ No | Auto-generated on `next dev`; must not be committed. |

**Disposition:** The commit conflates Phase 0B evidence with unrelated doc
work and generated artifacts. On the clean branch, evidence is landed in a
narrowly-scoped commit that stages **only** the Phase 0B evidence files by
explicit path; `git add -A` is forbidden.

## Summary

| Commit | Files | Direct | Supporting | Unrelated | Generated | Clean-branch action |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `1e5a6bd94` | 255 | 0 | 0–1 | 254–255 | 0 | **Drop entirely.** Test-infra sweep → future `chore/test-infrastructure-stabilization` branch. |
| `511c9c1cb` | 3 | 3 | 0 | 0 | 0 | Retain all 3 (with post-decision wording review). |
| `c40a3e33a` | 2 | 1 | 1 | 0 | 0 | Retain, then add production integration commit. |
| `896a18e0c` | 1 | 1 | 0 | 0 | 0 | Retain, plus companion DB migration commit. |
| `7a1c90ab3` | 112 | ~44 | 1 | 45 | ~22 | Retain Phase 0B evidence subset only, staged by explicit path. |

## Non-actions

- The 5 pushed commits are **not** rewritten, deleted, or force-pushed.
- The `fix/union-eyes-reality-remediation` branch is preserved as a complete
  historical record.
- No environment is deployed from either branch during Phase 0B.1.
