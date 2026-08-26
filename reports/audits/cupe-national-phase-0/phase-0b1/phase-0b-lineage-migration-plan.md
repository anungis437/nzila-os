# Phase 0B.1 — Conditional Two-Lineage Migration Plan

**Status:** Conditional on architecture decision in
[phase-0b-lineage-architecture-decision.md](phase-0b-lineage-architecture-decision.md).  
This document does not itself execute any DB change. It records the plan
that will be followed *once* Aubert selects an option.

## Common preconditions (all options)

1. Full logical backup of every environment that carries either lineage.
2. Snapshot of `information_schema.tables` and `pg_class` per environment
   into `reports/audits/cupe-national-phase-0/logs/pre-migration-state-<env>.log`.
3. Read-only "drill" run against a disposable database seeded from the
   snapshot, producing an execution report before touching any real env.
4. Rollback script for each new migration, kept beside the migration.

## Common invariants (all options)

- Migration `0038` remains the source of truth for the
  `organizations.platform_tenant_id = organizations.id = orgs.id` contract.
- Every new migration guards its DDL with `IF NOT EXISTS` or a
  conditional `DO $$` block, so it can be replayed against any of the
  three states (empty DB / partial state / final state) without error.
- Every new migration records an entry in `drizzle.__phase0b_outcomes`
  (or a successor table) with an outcome-class constrained to a
  documented enumeration.

---

## If Option A (single owner per table)

1. Author a comprehensive rename map: for each of the 100
   `REQUIRES_DECISION` tables, assign ownership to one lineage and
   rename the loser to an unambiguous name (e.g. `ue_reports`).
2. Sequence renames so no live reader is orphaned mid-migration.
3. Update the losing lineage's code paths (SQL, model definitions,
   query builders, RLS policies) in the same commit as each rename.
4. Django framework tables (`auth_*`, `django_*`) MUST remain Django-owned.
   Any platform-lineage DDL that touches them is removed.
5. Track migration order in `phase-0b-option-a-migration-order.md`.

Estimated blast radius: high — touches ~half of both lineages.

---

## If Option B (dual schema, no additional governance)

1. Create schema `union_eyes`. Move Django-owned tables into it.
2. Update Django `DATABASES['default']['OPTIONS']['options']` to set
   `-c search_path=union_eyes,public`.
3. Update every Drizzle client + platform SQL migration to set
   `search_path=public` (default) explicitly.
4. Republish `organizations` and `orgs` from their owner schema into the
   other via a view.
5. Test cross-schema FK preservation (Postgres allows this; Django's ORM
   sometimes struggles).

Estimated blast radius: moderate — mostly configuration + schema moves.

---

## If Option C (separate databases)

1. Provision `union_eyes` PostgreSQL database (per-env).
2. Cut Django `DATABASES['default']['NAME']` over to `union_eyes`.
3. Rewrite every cross-lineage query in application code as either
   (a) an FDW query, or (b) a synchronous API call, or (c) an event-driven
   projection maintained in each DB.
4. Replace migration 0038's cross-lineage FKs with an application-level
   contract + reconciliation job.
5. Duplicate every operational surface (backup, monitoring, RLS, RBAC).

Estimated blast radius: high — architecture-wide. Not recommended.

---

## If Option D (governed hybrid) — recommended

Phase 1 (immediate):

1. Execute all Option B steps.
2. Author `tooling/lineage-governance/no-new-public-collisions.ts` — a
   CI check that fails on any PR introducing a new `public.<name>` table
   that already exists in the other lineage.
3. Author `docs/architecture/lineage-boundary.md` documenting the rule.

Phase 2 (over the next N phases):

4. Author `phase-0b-option-d-deprecation-plan.md` sequencing the 100
   `REQUIRES_DECISION` tables into cohorts (framework internals →
   Django-owned → shared-intent contracts → platform-owned).
5. Each cohort migrates in a separate downstream phase (0C, 0D, 1, ...).
6. Each cohort has its own migration file, rollback script, and
   validation report.

Estimated blast radius: moderate immediately (Option B work) + long tail
of cohort migrations.

---

## Sign-off requirements per option

| Option | Approver | Sign-off document |
| --- | --- | --- |
| A | Aubert + one platform reviewer | `phase-0b-option-a-signoff.md` |
| B | Aubert | `phase-0b-option-b-signoff.md` |
| C | Aubert + infra reviewer | `phase-0b-option-c-signoff.md` |
| D | Aubert | `phase-0b-option-d-signoff.md` + `phase-0b-option-d-deprecation-plan.md` |

## Non-actions

- This document does not itself execute any option.
- No environment is deployed as part of publishing this document.
- No CUPE scenario is graduated as a result of this document.
