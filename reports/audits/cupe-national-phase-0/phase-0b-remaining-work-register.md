# Phase 0B — Remaining Work Register

**Status.** ACTIVE — enumerates every deferred item that must be closed before Phase 0B can be re-classified from AMBER to GREEN, plus items that are Phase-0C or later.
**Date.** 2026-04-25 (Aubert local wall-clock).
**Scope.** Single source of truth for what is left after this session's Phase 0B work. Every AMBER classification in this session's evidence artifacts points here.

Anchor documents:
- `organization-model-decision.md` (Outcome C contract)
- `organization-model-verification.md` (dev-DB proof + AMBER re-classification)
- `phase-0b-two-lineage-governance-finding.md` (primary blocker)
- `phase-0b-clean-db-proof.md` (three probes, partial proof)
- `phase-0b-validation-summary.md` (final AMBER closure report)

---

## 1. Blockers on Phase 0B GREEN

### 1.1 Two-lineage consolidation

**Blocker.** 111 tables are created with the same `public.<name>` by both the platform and Django lineages (see `phase-0b-two-lineage-governance-finding.md`). Neither ordering composes on a governed clean DB, so the substantive `applied` outcome of migration 0038 cannot be reached through checked-in artifacts alone.

**Required work.**
1. Draft `reports/audits/cupe-national-phase-0/two-lineage-consolidation-decision.md` enumerating the 111 collisions and assigning per-table canonical ownership.
2. Execute the resulting migrations (drop losing-side duplicates from the appropriate lineage).
3. Add a CI job `.github/workflows/clean-db-composition.yml` that: creates a fresh Postgres DB, runs platform bootstrap + incrementals, runs `python manage.py migrate`, asserts `drizzle.__phase0b_outcomes.outcome_class = 'applied'`, asserts `organizations_row_count > 0` and `fk_constraint_present = true`.

**Owner.** Architecture (unassigned at time of writing).
**Blocks.** Phase 0B GREEN.

### 1.2 Substantive `applied` outcome proof on a governed clean DB

**Blocker.** Follows from 1.1. Cannot be executed until the lineage consolidation is done.

**Required work.** Once 1.1 is closed, re-run the probe_v4 sequence but with the successful Django ordering appended, and capture the marker row as `outcome_class = applied` with `fk_constraint_present = true` and `check_constraint_present = true`.

**Owner.** Same as 1.1.
**Blocks.** Phase 0B GREEN.

### 1.3 Governed provisioning of production/staging organizations

**Blocker.** The 4 synthetic QA orgs and the 5 pre-existing shared-UUID pairs exist only on the dev DB. Staging and production do not yet have these mappings. The transactional resolver `apps/union-eyes/lib/organizations/platform-tenant.ts` exists but has never been executed against staging or production.

**Required work.**
1. For each real institutional tenant, decide whether it is a platform-participating organization; if yes, provision via `provisionPlatformParticipant`.
2. Add a one-shot admin route or script that emits an audit log for every provisioning call.
3. Verify `SELECT count(*) FROM organizations WHERE platform_tenant_id IS NOT NULL` grows monotonically across staging and prod deploys.

**Owner.** Application team.
**Blocks.** Phase 0B GREEN on staging and production.

---

## 2. AMBER items that must move to CLOSED before Phase 0B is GREEN

### 2.1 KPI identifier DB-level enforcement

**Current state.** Engine and schema declaration agree at the TypeScript level (`packages/ue-cognition/src/schema.ts` — 6 tables changed from `uuid` to `text`). DB column types on any given environment still reflect whichever `drizzle-kit push` last ran. See `kpi-identifier-proof.md`.

**Required work.**
1. Promote the UE cognition tables into the governed platform migration lineage (either as a new `packages/db/drizzle/0039_ue_cognition_tables.sql` or as their own governed lineage under `packages/ue-cognition/db/migrations/`).
2. Include `ALTER COLUMN id TYPE text` for each of the 6 tables in the promotion migration, guarded against pre-existing column-type states.
3. Add a marker in `drizzle.__phase0b_outcomes` (or a similar substantive-outcome table) recording that the KPI identifier contract is enforced.

**Owner.** Application team (with platform review).

### 2.2 Removal of `drizzle-kit push` dependency on the dev DB

**Current state.** The dev DB `nzila_automation` contains `public.organizations` and other application-lineage tables that were created by `drizzle-kit push` and are not reproducible from checked-in artifacts alone.

**Required work.** As part of the 1.1 consolidation, promote every `drizzle-kit push`-owned table into the governed lineage of its bounded context (platform or Django) and remove the push commands from any developer workflow.

**Owner.** Application team.

### 2.3 Backfill of the 40 unmapped `organizations` rows

**Current state.** 40 of the 49 dev-DB `organizations` rows have `platform_tenant_id IS NULL`. These are legitimate union-hierarchy entities (federations, districts, congress, non-platform-participating locals) and are correct as-is under Outcome C.

**Required work.** After 1.3, re-audit these 40 rows against the (now real) list of platform-participating tenants; promote any that should be participating; document the remainder as intentionally-unmapped.

**Owner.** Business + application team jointly.

---

## 3. Ex-scope items (Phase 0C or later)

The following were discovered during Phase 0B but are outside its explicit scope. They are recorded here so they do not vanish from institutional memory.

- **Phase 0C — Migration ledger audit.** The platform migration ledger table `drizzle.__platform_migrations` records `outcome_class` values (`full-success`, `partial-success`, etc.) but the semantics of those values are not documented anywhere. `full-success` currently means "the SQL file executed to completion" — it does not distinguish substantive from no-op paths. Every migration that has a guarded early-return path (0038 is the first, but there will be more) needs its own substantive-outcome marker table or must extend `__platform_migrations` with a substantive-outcome column.
- **Phase 0C — Migration test harness.** There is no automated test that applies the entire migration lineage to a fresh DB and asserts final state. `packages/db/drizzle/migration-baseline-design.md` proposes one but it has never been executed. This is the pre-condition for automating the clean-DB composition CI job (1.1.3 above).
- **Phase 0D — Application-lineage governance.** The Django lineage (`apps/union-eyes/backend/*/migrations/`) has no equivalent of `drizzle.__platform_migrations` for tracking substantive outcomes. The Django `django_migrations` table only records whether a migration was applied, not whether its intended contract is in force. If Phase 0B's marker-table pattern becomes the repository standard, Django migrations should adopt it too.
- **Phase 1 — CI enforcement.** No current CI job blocks a merge that would break clean-DB composition. This is the natural home for the CI job proposed in 1.1.3.

---

## 4. Register maintenance

Every item above must be tracked to closure. When an item is closed, edit this file to move it into a `Closed items (with proof)` section at the bottom rather than deleting it, so that Phase 0B history remains audit-legible.
