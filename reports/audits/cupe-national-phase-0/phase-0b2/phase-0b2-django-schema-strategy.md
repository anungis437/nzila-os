# Phase 0B.2 — Django Schema Strategy for the `union_eyes` Schema

**Phase:** 0B.2 (governed hybrid execution)
**Architecture decision:** Option D — Governed hybrid ([approval](./phase-0b2-architecture-approval.md))
**Related:**
- [`phase-0b2-foundational-slice.md`](./phase-0b2-foundational-slice.md)
- [`phase-0b2-ownership-manifest.md`](./phase-0b2-ownership-manifest.md)

---

## 1. Objective

Establish a **single, governed** way for Django models in `apps/union-eyes/backend/**` to
live inside the `union_eyes` PostgreSQL schema without competing with the platform
lineage's `public` schema. The chosen strategy must:

- Move Union-Eyes-owned tables **out of `public`** (never compete with platform DDL).
- Let Django **adopt** platform-owned shared tables in `public` **without** re-creating
  them (no duplicate `CreateModel` in Django migrations).
- Preserve Django's ability to run migrations, admin, and ORM queries on both categories.
- Be idempotent, first-run-safe, and reviewable in normal `makemigrations` output.

---

## 2. Chosen strategy

**Explicit per-table `db_table = 'union_eyes.<name>'`** on every Django model that lives
outside `public`, backed by an explicit `RunSQL('CREATE SCHEMA IF NOT EXISTS union_eyes')`
as the **first operation** of the earliest Union-Eyes-owned migration in the migration
graph.

For **platform-owned shared** tables that Django reads (currently only
`public.stripe_webhook_events`, and eventually `public.audit_events` and
`public.organization_members` once foundational rows migrate under §8/§10), the Django
model uses `db_table = 'public.<name>'` **and** `Meta.managed = False`. Django never
issues DDL against those tables — DDL owner remains the platform.

For **UE-owned** tables inside `union_eyes` (`union_eyes.organizations`, the six UE
Cognition telemetry tables, and every non-foundational UE-owned table in later waves),
Django keeps `managed = True` and owns the DDL exclusively.

---

## 3. Model configuration matrix

| Ownership class | `db_table` value | `Meta.managed` | Migrations author | Example |
| --- | --- | --- | --- | --- |
| `UNION_EYES_OWNED_SHARED` | `'union_eyes.<name>'` | `True` | Django | `union_eyes.organizations` |
| `UNION_EYES_OWNED_EXCLUSIVE` | `'union_eyes.<name>'` | `True` | Django | UE Cognition telemetry, bargaining, CBA, chatbot, etc. |
| `PLATFORM_OWNED_SHARED` | `'public.<name>'` | `False` | Platform (Drizzle) | `public.stripe_webhook_events`, `public.orgs`, `public.audit_events`, `public.organization_members` |
| `PLATFORM_OWNED_EXCLUSIVE` | *(no Django model)* | *(n/a)* | Platform (Drizzle) | `public.pilot_definitions`, `public.commerce_*`, `public.evidence_packs` |
| `DJANGO_INTERNAL` | *(Django default; never overridden)* | `True` | Django framework | `auth_*`, `django_*` — live in `union_eyes` because Django runs against that schema, but they retain their native names via Django's `settings.DATABASES` `OPTIONS` / `search_path` (see §5). |
| `SAME_NAME_DIFFERENT_MEANING` | `'union_eyes.<renamed>'` | `True` | Django (renamed) | Deferred: `documents` → `union_eyes.content_documents`, `votes` → `union_eyes.union_votes`. |

---

## 4. Migration ordering

1. The earliest Union-Eyes-owned migration in the migration graph runs:

   ```python
   operations = [
       migrations.RunSQL(
           sql="CREATE SCHEMA IF NOT EXISTS union_eyes;",
           reverse_sql="-- schema drop deferred; do not drop union_eyes automatically",
       ),
       # ...subsequent CreateModel operations
   ]
   ```

2. Every subsequent `CreateModel` in the same migration (and in every downstream
   migration) uses `Meta.db_table = 'union_eyes.<name>'`, so the resulting `CREATE TABLE`
   is qualified into the new schema.

3. For **foundational** UE-owned tables that already exist in `public.<name>` today, the
   §8 migration (relocation) performs one of the following (row-count preserving) moves:

   ```sql
   ALTER TABLE public.<name> SET SCHEMA union_eyes;
   ```

   followed by validating the row count against a `pg_stat_user_tables` snapshot captured
   immediately before the move. Downstream Django models are updated to declare
   `db_table = 'union_eyes.<name>'`; `SeparateDatabaseAndState` is used to record the
   `db_table` change in Django's state without re-issuing DDL.

4. For platform-owned shared tables Django adopts (§9), the Django-side migration uses
   `SeparateDatabaseAndState` with an **empty** `database_operations` list and a state-only
   `AlterModelTable(name='<Model>', table='public.<name>')` so that Django's model state
   matches reality without touching the platform-owned DDL.

---

## 5. `search_path` policy

The strategy chosen above does **not** rely on a per-connection `search_path` redirection.
Every table access is explicitly qualified via `db_table`.

The Django connection may still keep `search_path = "$user", public, union_eyes"` for
framework internals (Django's own `django_migrations`, `django_content_type`, `auth_*`
tables end up in whichever schema is created first when running against the shared DB —
per Section 2 of the architecture approval those are held in `union_eyes`), but that
default is **advisory** and never used to resolve application-owned tables. Application
tables are always qualified. This eliminates the "same table name resolves differently
depending on connection state" risk that Option A (global search_path redirection) would
have introduced.

---

## 6. Rejected alternatives

| Alternative | Why rejected |
| --- | --- |
| **Global `search_path` redirection** (set `search_path=union_eyes,public` at connect time and let Django use unqualified names) | Silently changes resolution of platform-owned tables when accessed from Django; ordering of `union_eyes` before `public` is a footgun for shared tables; testing surface becomes non-local (a schema-search-path change in one place affects every model). |
| **Uncontrolled `SeparateDatabaseAndState`** (Django models declare only state, no DDL, and hope the platform materialises everything) | Loses Django's ability to run makemigrations for legitimately UE-owned tables; requires manual coordination for every new UE model; violates "one DDL owner per table" from the outside because Django appears to "own" tables it never actually creates. |
| **Multiple Django databases** (one connection to `union_eyes` schema, one to `public`) | Doubles connection pool, breaks cross-schema FK integrity, cannot express the `union_eyes.organizations.platform_tenant_id → public.orgs.id` FK in a single transaction. |
| **Renaming every UE table with a `ue_` prefix in `public`** | Cosmetic — still a single-schema world; does not enable per-owner DDL isolation; requires renaming 90+ tables now for no invariant gain. |
| **Materialised views in `public` that mirror `union_eyes.*`** | Duplicates data or requires refresh triggers; introduces staleness at read time; not needed for foundational slice. |

---

## 7. Foundational slice bindings

Concrete assignments for the 13 foundational tables (see [`phase-0b2-foundational-slice.md`](./phase-0b2-foundational-slice.md#2-foundational-tables-13)):

| Table | Django model config in §8/§9/§10 |
| --- | --- |
| `public.orgs` | Platform-owned. If Django needs read access, add `managed = False` model with `db_table = 'public.orgs'`. Not required for §11 wiring (resolver reads via Drizzle client). |
| `union_eyes.organizations` | `db_table = 'union_eyes.organizations'`, `managed = True`, `Meta.db_table` unchanged from Django state after §8 relocation. |
| `public.organization_members` | Adopted via `managed = False`, `db_table = 'public.organization_members'`. Foundational rows written by platform side; Django reads only. |
| `public.audit_events` | Adopted via `managed = False`, `db_table = 'public.audit_events'`. Django writes go through the resolver, never through the ORM directly. |
| `public.pilot_definitions`, `public.pilot_metric_events`, `public.pilot_metric_rollups` | No Django model required. Platform-owned exclusive. |
| Six `ue_cognition_*` / `ue_*_snapshots` tables | `db_table = 'union_eyes.<name>'`, `managed = True`. Text-ID promotion is a `RunSQL` in migration 0039 (§12). |

---

## 8. Verification (executed in §17)

- `pnpm tsx tooling/checks/schema-ownership-validate.ts` — enforces the ownership manifest matches this strategy.
- Composition proof (§14) runs the earliest Union-Eyes-owned migration against a **fresh** Postgres database and asserts `SELECT current_schema()` reports `union_eyes` exists and contains the expected foundational UE-owned tables.
- Existing-DB proof (§15) runs the same migrations against a disposable clone of the staging DB and asserts row counts survive the schema move.
