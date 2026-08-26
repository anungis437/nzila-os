# Phase 0B — Clean-DB Proof

**Status.** PARTIAL — the false-success-prevention mechanism is proven on a governed clean DB (probe_v4); the substantive `applied` outcome is not proven on a governed clean DB because neither lineage ordering composes.
**Date.** 2026-04-25 (Aubert local wall-clock).
**Scope.** Records the three probe DBs created during Phase 0B, what was applied to each, what the substantive-outcome marker table (`drizzle.__phase0b_outcomes`) recorded, and where the evidence lives.

Anchor documents:
- `organization-model-verification.md`
- `phase-0b-two-lineage-governance-finding.md`
- `phase-0b-remaining-work-register.md`

Evidence logs live under `reports/audits/cupe-national-phase-0/logs/`.

---

## 1. Substantive-outcome marker table (design)

Migration `0038_phase_0b_organization_and_kpi_integrity.sql` unconditionally creates:

```sql
CREATE TABLE IF NOT EXISTS drizzle.__phase0b_outcomes (
  migration_filename                text PRIMARY KEY,
  outcome_class                     text NOT NULL,
  organizations_row_count           integer,
  orgs_row_count                    integer,
  platform_tenant_id_mapped_count   integer,
  fk_constraint_present             boolean,
  check_constraint_present          boolean,
  notes                             text,
  recorded_at                       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase0b_outcomes_outcome_class_check
    CHECK (outcome_class IN ('applied', 'deferred-app-schema-absent'))
);
```

Every apply of 0038 inserts (or upgrades via `ON CONFLICT (migration_filename) DO UPDATE`) exactly one row. The `outcome_class` value distinguishes:

- `applied` — `public.organizations` was present at apply time; all 8 sub-operations executed; FK + CHECK + index + backfill + provisioning are in place. Post-state row counts and constraint presence booleans are captured.
- `deferred-app-schema-absent` — `public.organizations` was absent; the migration issued `RAISE NOTICE` and returned; no substantive DDL ran. Row counts are NULL; constraint booleans are `false`; notes explain how to upgrade the outcome.

Downstream consumers verifying Phase 0B in force MUST read `drizzle.__phase0b_outcomes`, not `drizzle.__platform_migrations`.

---

## 2. Probe DBs, chronologically

### 2.1 `nzila_phase0b_probe_v2` — platform-first, then Django (attempted)

Sequence executed this session:

1. `DROP DATABASE IF EXISTS nzila_phase0b_probe_v2; CREATE DATABASE nzila_phase0b_probe_v2 OWNER nzila;`
2. `node tooling/scripts/apply-platform-migrations.mjs --bootstrap-apply` → 1 artifact applied (log: `logs/phase-0b-clean-db-django-bootstrap.log`).
3. `node tooling/scripts/apply-platform-migrations.mjs` → 39 migrations applied. Marker row: `outcome_class = deferred-app-schema-absent` (correct — `organizations` not created by platform lineage). Log: `logs/phase-0b-clean-db-django-platform-apply.log`.
4. `PGDATABASE=nzila_phase0b_probe_v2 python manage.py migrate` → **FAILED** at `billing.0001_initial` with `relation "stripe_webhook_events" already exists`. Log: `logs/phase-0b-clean-db-django-migrate.log`.

**Verdict.** Platform-first ordering does not compose on a governed clean DB. The marker table honestly recorded the deferred outcome for the platform-only slice.

**Caveat.** During analysis this session, `probe_v2` was found to contain 22 rows in `django_migrations` after only the platform-only apply. Platform migrations do not create `django_migrations`. The most plausible explanation is that `probe_v2` was created earlier in the session (before the current turn's DROP+CREATE) and retained Django artifacts; the DROP+CREATE that preceded step 2 above may not have been the first initialization. Because this ambiguity could weaken the false-success-prevention proof, a fresh probe (`probe_v4`) was created specifically to eliminate it — see § 2.3.

### 2.2 `nzila_phase0b_probe_v3` — Django-first, then platform (attempted)

Sequence executed this session:

1. `DROP DATABASE IF EXISTS nzila_phase0b_probe_v3; CREATE DATABASE nzila_phase0b_probe_v3 OWNER nzila;`
2. `PGDATABASE=nzila_phase0b_probe_v3 python manage.py migrate` → OK, 549 public tables. Log: `logs/phase-0b-clean-db-django-first-migrate.log`. `public.organizations` present.
3. `node tooling/scripts/apply-platform-migrations.mjs --bootstrap-apply` → OK. Log: `logs/phase-0b-clean-db-django-first-bootstrap.log`.
4. `node tooling/scripts/apply-platform-migrations.mjs` → **FAILED** at `0000_initial.sql` with `relation "votes" already exists`. Log: `logs/phase-0b-clean-db-django-first-platform-apply.log`.

**Verdict.** Django-first ordering does not compose on a governed clean DB either. Platform incremental migrations never ran, so `drizzle.__phase0b_outcomes` has no row for 0038 in `probe_v3`.

Additional artifacts:
- `logs/phase-0b-django-first-public-tables.log` — list of the 549 tables.
- `logs/phase-0b-true-lineage-conflicts.log` — 111 tables created by both lineages (governance finding).

### 2.3 `nzila_phase0b_probe_v4` — pure platform-only (canonical false-success-prevention proof)

Sequence executed this session:

1. `DROP DATABASE IF EXISTS nzila_phase0b_probe_v4; CREATE DATABASE nzila_phase0b_probe_v4 OWNER nzila;`
2. `node tooling/scripts/apply-platform-migrations.mjs --bootstrap-apply` → 1 artifact applied.
3. `node tooling/scripts/apply-platform-migrations.mjs` → 39 migrations applied. Log: `logs/phase-0b-clean-db-platform-only-apply.log`.
4. `SELECT * FROM drizzle.__phase0b_outcomes` → single row. Log: `logs/phase-0b-clean-db-marker-probe-v4.log`:

```
                migration_filename                |       outcome_class        | organizations_row_count | orgs_row_count | platform_tenant_id_mapped_count | fk_constraint_present | check_constraint_present
--------------------------------------------------+----------------------------+-------------------------+----------------+---------------------------------+-----------------------+--------------------------
 0038_phase_0b_organization_and_kpi_integrity.sql | deferred-app-schema-absent |                         |              0 |                                 | f                     | f
```

**Verdict.** The false-success-prevention mechanism works correctly on a governed clean DB. `drizzle.__phase0b_outcomes` distinguishes the deferred outcome from the applied outcome, records NULL row counts, and records both constraint booleans as `false`. Downstream consumers cannot be misled into believing the same-UUID contract is in force.

---

## 3. What is and is not proven on a governed clean DB

| Property | Status | Evidence |
| --- | --- | --- |
| Migration 0038 executes without error on platform-only DB | Proven | `logs/phase-0b-clean-db-platform-only-apply.log` |
| Marker table exists and is written on every apply of 0038 | Proven | `logs/phase-0b-clean-db-marker-probe-v4.log` |
| `outcome_class = deferred-app-schema-absent` recorded when `organizations` is absent | Proven | probe_v4 marker |
| No FK / CHECK / index / backfill runs on deferred outcome | Proven | probe_v4 marker booleans `false`, row counts `NULL` |
| `outcome_class = applied` reachable on a governed clean DB | **NOT proven** | Both orderings fail — see `phase-0b-two-lineage-governance-finding.md` |
| Same-UUID contract enforced on a governed clean DB | **NOT proven** | Same blocker |
| Same-UUID contract enforced on the dev DB | Proven (out-of-band) | `organization-model-verification.md` § 2 |

---

## 4. Verdict

The clean-DB proof is honestly split. The half that could be proven — that the substantive-outcome marker table prevents false success on a database where `organizations` is absent — is fully proven on probe_v4. The half that could not be proven — that both lineages compose on a governed clean DB to yield the `applied` outcome — is blocked by the two-lineage governance finding.

**Clean-DB proof: PARTIAL.** False-success prevention is CLOSED; substantive-outcome proof is DEFERRED until the two-lineage consolidation work is completed.
