# Phase 0B — Two-Lineage Governance Finding

**Status.** OPEN — governance defect discovered during Phase 0B governed clean-DB proof; out of Phase 0B scope; blocks GREEN closure of Phase 0B.
**Date.** 2026-04-25 (Aubert local wall-clock).
**Scope.** A structural finding, discovered during the governed clean-DB proof of Phase 0B, that the two schema lineages of this repository (platform + Django) currently create 111 tables with the same `public.<name>` on a fresh database, using bare `CREATE TABLE` (without `IF NOT EXISTS`), so neither ordering composes on a governed clean DB. This document records the finding as a first-class governance defect and defines what work is required before Phase 0B can be closed as GREEN.

Anchor documents:
- `organization-model-verification.md` §§ 5–6
- `phase-0b-clean-db-proof.md`
- `phase-0b-remaining-work-register.md`
- Evidence log: `logs/phase-0b-true-lineage-conflicts.log`

---

## 1. What was discovered

Applying both lineages to the same fresh PostgreSQL database was attempted this session in both possible orderings. Both failed.

### 1.1 Platform-first

Environment: fresh DB `nzila_phase0b_probe_v2` (DROP + CREATE this session).

```
step 1: node tooling/scripts/apply-platform-migrations.mjs --bootstrap-apply → OK
step 2: node tooling/scripts/apply-platform-migrations.mjs                    → OK, 39/39 applied
step 3: PGDATABASE=nzila_phase0b_probe_v2 python manage.py migrate           → FAIL
        django.db.utils.ProgrammingError: relation "stripe_webhook_events" already exists
```

Root cause: platform lineage's `packages/db/drizzle/0000_initial.sql` created `stripe_webhook_events` (among 111 others — see § 2). Django's `billing.0001_initial` then attempted `CREATE TABLE stripe_webhook_events (...)` (no `IF NOT EXISTS`) and Postgres rejected it with SQLSTATE `42P07`.

Log: `logs/phase-0b-clean-db-django-migrate.log`.

### 1.2 Django-first

Environment: fresh DB `nzila_phase0b_probe_v3` (DROP + CREATE this session).

```
step 1: PGDATABASE=nzila_phase0b_probe_v3 python manage.py migrate           → OK, 549 public tables
step 2: node tooling/scripts/apply-platform-migrations.mjs --bootstrap-apply → OK
step 3: node tooling/scripts/apply-platform-migrations.mjs                    → FAIL
        [migrate:fail] failure applying 0000_initial.sql:
        error: relation "votes" already exists
```

Root cause: symmetric. Django's `bargaining.0001_initial` created `votes`. Platform lineage's `0000_initial.sql` then attempted `CREATE TABLE votes (...)` (no `IF NOT EXISTS`) and Postgres rejected it.

Log: `logs/phase-0b-clean-db-django-first-platform-apply.log`.

---

## 2. Scale of the overlap

Comparison of the freshly-migrated Django-only DB (`probe_v3`, 549 public tables) against the freshly-migrated platform-only DB (`probe_v4`, 168 public tables) yields **111 tables that both lineages create with the same `public.<name>`**.

Selected examples of the 111 (full list: `logs/phase-0b-true-lineage-conflicts.log`):

- **Identity & tenancy:** `organizations`, `orgs`, `auth_user`, `auth_group`, `sso_providers`, `mfa_configurations`, `user_roles`, `user_permissions`
- **Commerce:** `stripe_webhook_events`, `stripe_customers`, `subscriptions`, `invoices`, `payments`, `products`, `prices`
- **Governance:** `votes`, `elections`, `ballots`, `motions`, `proposals`, `resolutions`
- **Analytics & KPIs:** `kpi_configurations`, `analytics_metrics`, `ab_tests`, `feature_flags`
- **Content:** `documents`, `chat_messages`, `chat_sessions`, `notifications`, `audit_logs`
- **Infrastructure:** `django_migrations` (Django); overlaps with platform when platform runs after Django

None of the 111 collisions are "the same table" in the semantic sense — the Django-owned `organizations` schema and the platform-owned `orgs` schema are deliberately different bounded contexts under Outcome C — but on the DDL level they collide by name and prevent composition.

---

## 3. Why this is a first-class governance defect

The prior verification (before this session) treated the dev DB `nzila_automation` as authoritative and assumed both lineages had always been safe to co-apply. That assumption was never governed:

- The dev DB accumulated over time through interleaved `drizzle-kit push`, ad-hoc backfills, `python manage.py migrate` runs, and manual `psql` sessions. It is not reproducible from checked-in artifacts alone.
- No CI job has ever attempted `pg createdb + platform-apply + django-migrate + assert` on a clean DB. Both lineages have been assumed compatible without ever being proven so.
- Because the Phase 0B directive requires the substantive `applied` outcome to be provable on a governed clean DB, and neither ordering composes on a clean DB, the substantive `applied` outcome is currently unreachable through checked-in artifacts.

**Consequence:** every current environment that runs both lineages (dev, staging, production) depends on the historical accident of DDL that happened to skip over pre-existing tables silently or to overwrite them in an order that no one has audited. That is not a governance posture.

---

## 4. What must change before Phase 0B can go GREEN

Options, in order of decreasing invasiveness:

### 4.1 Full lineage deconfliction (canonical fix)

For each of the 111 colliding names, decide which lineage owns the canonical table and remove the duplicate from the other. This is a large piece of architectural work that requires:

- Per-table ownership decisions (platform-owned vs Django-owned) documented in a new decision record.
- Migrations that drop the duplicated tables from the losing lineage.
- Application code changes wherever the losing side's models are still referenced.
- CI job that runs both lineages against a fresh DB and asserts zero conflicts.

### 4.2 Add `IF NOT EXISTS` to all initial migrations (minimum viable)

For every collision, change `CREATE TABLE <name>` to `CREATE TABLE IF NOT EXISTS <name>` in whichever lineage runs second, and accept that the two lineages hold divergent shape for the shared table names. This is a workaround, not a fix — it hides the ownership question rather than answering it — and it makes future schema evolution unsafe (either side can now silently no-op a shape change).

Explicitly rejected as a Phase 0B remediation because it does not satisfy Outcome C's requirement that the two tables represent one institutional tenant.

### 4.3 Rehome the platform lineage into the Django ledger (or vice versa)

Migrate every platform migration into a Django app (or every Django migration into the platform lineage) so that only one migration engine ever writes to `public`. This is the cleanest long-term answer but is the largest piece of work. It is not a Phase 0B deliverable.

---

## 5. Recommended next step (out of Phase 0B scope)

Open a decision record (`reports/audits/cupe-national-phase-0/two-lineage-consolidation-decision.md`) that:

1. Enumerates the 111 collisions from `logs/phase-0b-true-lineage-conflicts.log`.
2. Assigns per-table canonical ownership.
3. Selects one of the three options in § 4 (or a combination) as the target architecture.
4. Sequences the work into phases with acceptance criteria that include a CI job asserting clean-DB composition.

Only after that decision record is executed can Phase 0B's `applied` outcome be proven on a governed clean DB and Phase 0B be closed as GREEN.

---

## 6. Verdict

The Phase 0B governed clean-DB proof surfaced a genuine governance defect in the repository's schema architecture. The defect is not a Phase 0B regression — it has existed since both lineages were introduced — but it is a hard blocker on GREEN closure of Phase 0B because Phase 0B requires the substantive same-UUID contract to be provable on a governed clean DB.

**Two-lineage governance finding: OPEN.** Owner: architecture; blocker for Phase 0B GREEN; recommended next step is a two-lineage consolidation decision record.
