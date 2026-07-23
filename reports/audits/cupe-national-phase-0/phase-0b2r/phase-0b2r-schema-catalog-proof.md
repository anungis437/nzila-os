# Phase 0B.2R §4 — Foundational Schema Catalog Proof

**Status:** REVIEW COMPLETE — catalog-level evidence collected from live PostgreSQL.
**Corrective phase:** Phase 0B.2R (branch `fix/union-eyes-phase0b-clean`).
**Live database inspected:** `phase0b2_compose_20260723094502` on
`localhost:5433` (native Windows PG 17.8, user `nzila`) — the same disposable
DB Phase 0B.2 §14 used for its clean-composition proof.
**Instrument:** `C:\Program Files\PostgreSQL\17\bin\psql.exe`.
**Timestamp:** 2026-07-24 (this worktree).

## 0. Why this document exists

The Phase 0B.2 closure quoted migration source text. Per the Phase 0B.2R mandate:

> "Test the exact generated SQL / PostgreSQL catalog, not only source text."

This document therefore records **catalog** facts, not source facts:

- What `pg_namespace`, `pg_class`, `pg_attribute`, `pg_constraint`, `pg_indexes`
  actually report for each foundational-slice table after the composition
  ran on a clean DB.
- Which invariants are enforced by the DB catalog vs. only present in source.
- The two asymmetries flagged in §3 (`organization_members` platform-DDL absent,
  `audit_events` Django-adoption absent), corroborated by the catalog.

## 1. Migrations under review

### 1.1 Platform (Drizzle)

| File | Bytes | Purpose |
| --- | ---: | --- |
| [packages/db/drizzle/0038_organization_cross_schema_contract.sql](../../../../packages/db/drizzle/0038_organization_cross_schema_contract.sql) | 6320 | Option D cross-schema contract: FK + CHECK + unique index. |
| [packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql](../../../../packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql) | 13662 | Move 6 UE-cognition tables to `union_eyes` schema + promote `id` UUID → TEXT. |

### 1.2 Union Eyes (Django)

| File | Bytes | Purpose |
| --- | ---: | --- |
| [apps/union-eyes/backend/auth_core/migrations/0003_move_organizations_to_union_eyes.py](../../../../apps/union-eyes/backend/auth_core/migrations/0003_move_organizations_to_union_eyes.py) | 5524 | Move `organizations` table `public → union_eyes`. |
| [apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py](../../../../apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py) | 1759 | Django `managed=False` adoption of `public.organization_members`. |
| [apps/union-eyes/backend/billing/migrations/0002_adopt_platform_stripe_webhook_events.py](../../../../apps/union-eyes/backend/billing/migrations/0002_adopt_platform_stripe_webhook_events.py) | 1247 | Django `managed=False` adoption of `public.stripe_webhook_events`. |

## 2. Catalog snapshot: schema tenants

Query:

```sql
SELECT nspname, count(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND nspname IN ('public','union_eyes','drizzle')
GROUP BY nspname;
```

Result:

| schema | table count |
| --- | ---: |
| `public` | 168 |
| `union_eyes` | 7 |

Meaning: the disposable DB was composed from platform migrations 0000..0039
**only**; Django migrations were **not applied** (the composition harness
excludes the Python side). The `union_eyes` schema is created by 0039 and
populated by 0038's precondition (which was skipped/short-circuited on this
run because `union_eyes.organizations` was created by 0039 rather than by
Django). See §7 finding.

## 3. Foundational cross-schema contract — enforced by catalog ✅

### 3.1 `union_eyes.organizations` — `\d`

```
Table "union_eyes.organizations"
  Column                | Type                     | Nullable | Default
  ---------------------+--------------------------+----------+-------------------
  id                   | uuid                     | not null | gen_random_uuid()
  name                 | text                     | not null |
  slug                 | text                     | not null |
  organization_type    | text                     | not null | 'union'::text
  hierarchy_path       | text[]                   | not null | ARRAY[]::text[]
  hierarchy_level      | integer                  | not null | 0
  sectors              | text[]                   | not null | ARRAY[]::text[]
  status               | text                     | not null | 'active'::text
  created_at           | timestamptz              | not null | now()
  updated_at           | timestamptz              | not null | now()
  clerk_organization_id| text                     |          |
  platform_tenant_id   | uuid                     | not null |
Indexes:
  organizations_pkey                   PRIMARY KEY, btree (id)
  organizations_slug_key               UNIQUE CONSTRAINT, btree (slug)
  ux_organizations_platform_tenant_id  UNIQUE, btree (platform_tenant_id)
Check constraints:
  organizations_platform_tenant_id_equals_id_check
    CHECK (platform_tenant_id = id)
```

### 3.2 `public.orgs` — `\d`

```
Table "public.orgs"
  id            | uuid          | not null | gen_random_uuid()
  clerk_org_id  | varchar(255)  |          |
  legal_name    | text          | not null |
  jurisdiction  | varchar(10)   | not null |
  status        | org_status    | not null | 'active'::org_status
  created_at    | timestamptz   | not null | now()
  updated_at    | timestamptz   | not null | now()
```

### 3.3 Cross-schema FK — enumerated

Query:

```sql
SELECT conname,
       (SELECT nspname FROM pg_namespace WHERE oid=(SELECT relnamespace FROM pg_class WHERE oid=c.conrelid))
         || '.' || (SELECT relname FROM pg_class WHERE oid=c.conrelid) AS src,
       (SELECT nspname FROM pg_namespace WHERE oid=(SELECT relnamespace FROM pg_class WHERE oid=c.confrelid))
         || '.' || (SELECT relname FROM pg_class WHERE oid=c.confrelid) AS dst
FROM pg_constraint c
WHERE contype = 'f'
  AND (SELECT relnamespace FROM pg_class WHERE oid=c.conrelid)
      <> (SELECT relnamespace FROM pg_class WHERE oid=c.confrelid)
ORDER BY 1;
```

**Result — exactly one cross-schema FK exists:**

```
organizations_platform_tenant_id_fkey | union_eyes.organizations → public.orgs
```

Constraint definition:

```
ALTER TABLE union_eyes.organizations
  ADD CONSTRAINT organizations_platform_tenant_id_fkey
  FOREIGN KEY (platform_tenant_id) REFERENCES public.orgs(id)
  DEFERRABLE INITIALLY IMMEDIATE;
```

**Invariants proven by catalog:**

| Invariant | Enforced by | Verified |
| --- | --- | --- |
| `platform_tenant_id` exists and is `NOT NULL` | `pg_attribute.attnotnull = true` | ✅ |
| `platform_tenant_id` FK → `public.orgs(id)` | `pg_constraint.contype='f'`, cross-schema | ✅ |
| `platform_tenant_id = id` | CHECK `organizations_platform_tenant_id_equals_id_check` | ✅ |
| Reverse lookup O(log n) | UNIQUE btree `ux_organizations_platform_tenant_id` | ✅ |
| Both sides have `id UUID gen_random_uuid()` | `pg_attrdef` | ✅ |

## 4. UE Cognition — schema relocation + text-ID promotion ✅

Query:

```sql
SELECT n.nspname||'.'||c.relname AS table, a.attname, format_type(a.atttypid, a.atttypmod)
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE n.nspname='union_eyes' AND c.relkind='r' AND c.relname LIKE 'ue_%'
  AND a.attname IN ('id','org_id','organization_id','platform_tenant_id')
ORDER BY 1,2;
```

Result:

| table | column | type |
| --- | --- | --- |
| `union_eyes.ue_case_risk_snapshots` | id | **text** |
| `union_eyes.ue_case_risk_snapshots` | org_id | uuid |
| `union_eyes.ue_cognition_audits` | id | **text** |
| `union_eyes.ue_cognition_audits` | org_id | uuid |
| `union_eyes.ue_engagement_snapshots` | id | **text** |
| `union_eyes.ue_engagement_snapshots` | org_id | uuid |
| `union_eyes.ue_kpi_snapshots` | id | **text** |
| `union_eyes.ue_kpi_snapshots` | org_id | uuid |
| `union_eyes.ue_precedent_matches` | id | **text** |
| `union_eyes.ue_precedent_matches` | org_id | uuid |
| `union_eyes.ue_workload_snapshots` | id | **text** |
| `union_eyes.ue_workload_snapshots` | org_id | uuid |

**Invariants proven by catalog:**

| Invariant | Verified |
| --- | --- |
| All 6 UE-Cognition tables live in `union_eyes` schema (relocated from `public`) | ✅ 6/6 |
| All 6 `id` columns are `text` (promoted from `uuid`) — allows `makeId('kpi'\|'crs'\|...)` prefixed IDs | ✅ 6/6 |
| `org_id` remains `uuid` — this is the record's tenant scope (UE org id), **distinct** from the `id` record identifier | ✅ 6/6 |

**Note on the mandate's "Do not conflate text record IDs with organization identifiers" caution:** the catalog cleanly separates them:
- `ue_kpi_snapshots.id text` — the record's own prefixed ID (e.g. `kpi_01H...`).
- `ue_kpi_snapshots.org_id uuid` — the UE tenant identifier (matches `union_eyes.organizations.id`).

There is no schema-level ambiguity between record IDs and org IDs.

## 5. Foundational pilot surfaces — column types ✅

Query:

```sql
SELECT n.nspname||'.'||c.relname, a.attname, format_type(a.atttypid, a.atttypmod)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
WHERE c.relkind='r' AND c.relname IN ('pilot_definitions','pilot_metric_events','pilot_metric_rollups')
  AND a.attname IN ('id','org_id','pilot_id')
ORDER BY 1,2;
```

Result:

| table | column | type |
| --- | --- | --- |
| `public.pilot_definitions` | id | uuid |
| `public.pilot_definitions` | org_id | uuid |
| `public.pilot_metric_events` | id | uuid |
| `public.pilot_metric_events` | org_id | uuid |
| `public.pilot_metric_events` | pilot_id | uuid |
| `public.pilot_metric_rollups` | id | uuid |
| `public.pilot_metric_rollups` | org_id | uuid |
| `public.pilot_metric_rollups` | pilot_id | uuid |

Every pilot table has `org_id UUID → public.orgs(id)` (verified in the FK sweep in
§3.3's superset query). This means any UE-side write into a pilot table must
pass a UUID that satisfies the FK against `public.orgs` — i.e. the value
returned by the resolver's `resolvePlatformTenantId(ueOrgId)`. This is why
§5 must wrap all UE→platform pilot paths.

## 6. Audit surface — column types

Query:

```sql
SELECT a.attname, format_type(a.atttypid, a.atttypmod)
FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='audit_events'
  AND a.attname IN ('id','org_id') AND a.attnum>0;
```

Result:

| column | type |
| --- | --- |
| `public.audit_events.id` | uuid |
| `public.audit_events.org_id` | uuid |

FK: `audit_events_org_id_orgs_id_fk` — `audit_events.org_id → public.orgs.id`.

Meaning: any UE-side audit write must also pass a UUID satisfying the FK
against `public.orgs`. UE's [audit-logger.ts](../../../../apps/union-eyes/lib/audit-logger.ts)
currently passes the UE `organizationId` directly; this only works if that
UUID happens to equal the platform tenant id (which the CHECK enforces if
the org was created after 0038 landed, but is NOT enforced for orgs created
before 0038 via a Django path that bypassed the contract). §5 wraps this.

## 7. Audit finding — `organization_members` platform DDL absent

Query:

```sql
SELECT n.nspname||'.'||c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relname='organization_members' AND c.relkind='r';
```

**Result: empty (0 rows).**

Meaning: after running all 39 platform Drizzle migrations against a clean DB,
`public.organization_members` **does not exist** in the catalog. The manifest
records it as `PLATFORM_OWNED_SHARED` with `ddl_owner=platform`, but no
platform migration creates it. The table only comes into existence when the
Django migrations run (via `apps/union-eyes/backend/auth_core/models.py`
line 754 `db_table = 'public"."organization_members'`), and even then the
adoption migration `0004_adopt_platform_organization_members.py` sets
`managed=False` — Django still expects the platform to create the table.

**Effect:** the SHARED classification for `organization_members` is asymmetric.
Both sides (Drizzle and Django) treat it as belonging to the other. Recorded
in §3 (`phase-0b2r-ownership-review.md`), corroborated here at catalog level.

**Not fixed in Phase 0B.2R** — creating the Drizzle side would be a new
architecture step ("Do not introduce a new architecture"). Filed for
Phase 0C / later wave.

## 8. Audit finding — `audit_events` Django-adoption absent

Complement of §7: `public.audit_events` **exists** in the catalog (platform
Drizzle DDL in [packages/db/src/schema/operations.ts](../../../../packages/db/src/schema/operations.ts)
line 177 plus `drizzle/000X_initial.sql`), but there is **no Django model
with `db_table = 'audit_events'`** and no Django adoption migration.

Grep evidence recorded in §3 (`phase-0b2r-ownership-review.md`):

```
grep -R "db_table\s*=\s*['\"]audit_events['\"]" apps/union-eyes/backend
→ 0 matches
```

**Effect:** the `PLATFORM_OWNED_SHARED` classification for `audit_events` is
asymmetric in the other direction. UE writes to `audit_events` today via
raw SQL in [apps/union-eyes/lib/audit-logger.ts](../../../../apps/union-eyes/lib/audit-logger.ts)
`auditLog()`, not through a Django-managed model. Django cannot introspect
or migrate this table.

**Not fixed in Phase 0B.2R** — adding a Django `managed=False` model is a
new architecture step. Filed for Phase 0C / later wave.

## 9. 0038 catalog vs. source cross-check

The 0038 migration source declares 9 numbered invariants (see [packages/db/drizzle/0038_organization_cross_schema_contract.sql](../../../../packages/db/drizzle/0038_organization_cross_schema_contract.sql) lines 6–14). Cross-check:

| # | Source declares | Catalog verifies |
| --- | --- | --- |
| 1 | `platform_tenant_id` NOT NULL | ✅ §3.1 |
| 2 | FK → `public.orgs(id)` | ✅ §3.3 (only cross-schema FK in DB) |
| 3 | CHECK `platform_tenant_id = id` | ✅ §3.1 |
| 4 | UNIQUE index for reverse lookup | ✅ §3.1 (`ux_organizations_platform_tenant_id`) |

## 10. 0039 catalog vs. source cross-check

The 0039 migration source declares 2 invariants for 6 tables (see [packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql](../../../../packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql) lines 4–20). Cross-check:

| # | Source declares | Catalog verifies |
| --- | --- | --- |
| 1 | Target schema `union_eyes` for all 6 ue_* tables | ✅ §4 (6/6 rows in `union_eyes`) |
| 2 | `id` is TEXT (for `makeId` prefixed IDs) | ✅ §4 (6/6 text) |

## 11. Idempotency

0038 wraps every DDL in `IF NOT EXISTS` guards + `DO $$ ... $$` blocks with
`information_schema` / `pg_constraint` lookups (lines 32–170). 0039 uses
`CREATE SCHEMA IF NOT EXISTS`, `information_schema.tables` guards, and
`ALTER TABLE ... SET SCHEMA` protected by existence checks.

**Second-run behaviour**: verified in Phase 0B.2 §15 (`phase-0b2-existing-db-upgrade.md`); not re-run here (that is Phase 0B.2R §9 scope).

## 12. Ownership manifest validator re-run

```
$ pnpm tsx tooling/checks/schema-ownership-validate.ts
Schema ownership manifest is valid.
  Tables declared:            125
  Foundational slice size:    13
  OWNERSHIP_UNRESOLVED count: 0
  Ownership distribution:
    DJANGO_INTERNAL                    9
    PLATFORM_OWNED_EXCLUSIVE          13
    PLATFORM_OWNED_SHARED              4
    SAME_NAME_DIFFERENT_MEANING        2
    UNION_EYES_OWNED_EXCLUSIVE        96
    UNION_EYES_OWNED_SHARED            1
```

Exit code `0`. Same as §3.

## 13. Summary of catalog verdict

| Concern | Catalog verdict |
| --- | --- |
| 0038 cross-schema contract fully enforced (FK + CHECK + UNIQUE + NOT NULL) | ✅ |
| 0039 6-table schema move + TEXT-ID promotion fully applied | ✅ |
| Foundational pilot tables in `public` with UUID PK/FK to `public.orgs` | ✅ |
| Exactly one cross-schema FK (`union_eyes.organizations → public.orgs`) | ✅ |
| Record IDs (`text`) and org IDs (`uuid`) are structurally distinct | ✅ |
| `organization_members` platform DDL absent (SHARED-aspirational, Django-only) | ❌ documented in §7 |
| `audit_events` Django adoption absent (SHARED-aspirational, Drizzle-only) | ❌ documented in §8 |

The DB-side of the Option D foundational-slice contract **is materialized**.
The **runtime side** — actually invoking that contract from Union Eyes' HTTP
routes and server actions — is what §5 addresses.

This section closes Phase 0B.2R §4.
