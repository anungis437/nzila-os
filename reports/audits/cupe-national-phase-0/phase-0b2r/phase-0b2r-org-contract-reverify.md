# Phase 0B.2R §6 — Org Cross-Schema Contract Re-Verification

**Status:** VERIFIED — Option D contract intact after §4 + §5 reclassifications
**Verified by:** Aubert Nungisa
**Verified at:** 2026-07-23
**Live database:** `phase0b2_compose_20260723094502` (PostgreSQL 17.8 native, port 5433)

---

## 1. Purpose

Phase 0B.2R §6 re-verifies that the six-part Option D org cross-schema contract
still holds after the §4 (`organization_members` reclassification) and §5
(`audit_events` reclassification) manifest repairs.

**Contract specification** (from Phase 0B design):

1. `public.orgs.id` — `UUID NOT NULL`
2. `union_eyes.organizations.id` — `UUID NOT NULL`
3. `union_eyes.organizations.platform_tenant_id` — `UUID NOT NULL`
4. Foreign key: `platform_tenant_id → public.orgs(id)` (DEFERRABLE)
5. Check constraint: `CHECK (platform_tenant_id = id)`
6. Unique index: `ux_organizations_platform_tenant_id` on `platform_tenant_id`

Mandate constraint being tested: *"Do not accidentally convert organization
identifiers to prefixed text IDs."*

## 2. Verification method

Live SQL introspection against the disposable Phase 0B.2R compose database
(`phase0b2_compose_20260723094502`), which was materialized from platform +
UE migrations. Neither §4 nor §5 landed any DDL changes, so this verification
also confirms the manifest repairs were data-only.

## 3. Column type verification

Query:

```sql
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'id';
```

Result:

| column_name | data_type | udt_name | is_nullable |
|-------------|-----------|----------|-------------|
| id          | uuid      | uuid     | NO          |

Query:

```sql
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'union_eyes' AND table_name = 'organizations'
  AND column_name IN ('id','platform_tenant_id')
ORDER BY column_name;
```

Result:

| column_name        | data_type | udt_name | is_nullable |
|--------------------|-----------|----------|-------------|
| id                 | uuid      | uuid     | NO          |
| platform_tenant_id | uuid      | uuid     | NO          |

**Contract items 1–3: PASS.** All three org identifier columns are strict
UUID NOT NULL. No prefixed text IDs anywhere in the org identity contract.

## 4. Constraint verification

Query:

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'union_eyes.organizations'::regclass
  AND (conname LIKE '%platform_tenant%' OR contype IN ('f','c','u'))
ORDER BY contype, conname;
```

Result:

| conname                                          | contype | pg_get_constraintdef                                            |
|--------------------------------------------------|---------|-----------------------------------------------------------------|
| organizations_platform_tenant_id_equals_id_check | c       | `CHECK ((platform_tenant_id = id))`                             |
| organizations_platform_tenant_id_fkey            | f       | `FOREIGN KEY (platform_tenant_id) REFERENCES orgs(id) DEFERRABLE` |
| organizations_slug_key                           | u       | `UNIQUE (slug)`                                                 |

**Contract items 4–5: PASS.** FK is present and DEFERRABLE (required for
Phase 0B.2 seeding order). CHECK constraint is present and enforces the
identity binding `platform_tenant_id = id`.

## 5. Unique index verification

Query:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='union_eyes' AND tablename='organizations'
ORDER BY indexname;
```

Result:

| indexname                            | indexdef                                                                                                                |
|--------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| organizations_pkey                   | `CREATE UNIQUE INDEX organizations_pkey ON union_eyes.organizations USING btree (id)`                                    |
| organizations_slug_key               | `CREATE UNIQUE INDEX organizations_slug_key ON union_eyes.organizations USING btree (slug)`                              |
| ux_organizations_platform_tenant_id  | `CREATE UNIQUE INDEX ux_organizations_platform_tenant_id ON union_eyes.organizations USING btree (platform_tenant_id)`   |

**Contract item 6: PASS.** The `ux_organizations_platform_tenant_id` unique
index is present. Combined with the CHECK constraint, this guarantees no two
UE orgs can share a platform tenant ID and each UE org is uniquely paired
with its platform record.

## 6. Data integrity verification

Query:

```sql
SELECT COUNT(*) AS orgs_count FROM public.orgs;
-- 1

SELECT COUNT(*) AS ue_orgs_count FROM union_eyes.organizations;
-- 1

SELECT COUNT(*) AS mismatches
FROM union_eyes.organizations
WHERE platform_tenant_id <> id;
-- 0

SELECT COUNT(*) AS orphans
FROM union_eyes.organizations o
LEFT JOIN public.orgs p ON o.platform_tenant_id = p.id
WHERE p.id IS NULL;
-- 0
```

Results:

- `public.orgs`: 1 seeded row (the pilot org).
- `union_eyes.organizations`: 1 seeded row.
- **Mismatches** (`platform_tenant_id <> id`): **0**.
- **Orphans** (UE org whose `platform_tenant_id` has no matching platform row): **0**.

**Data-level contract: PASS.** All seeded rows satisfy both the CHECK
constraint and the FK relationship.

## 7. Post-§4 / §5 impact

Neither §4 nor §5 landed DDL changes:

- §4 (`organization_members`) reclassified the manifest row from
  `PLATFORM_OWNED_SHARED` → `UNION_EYES_OWNED_SHARED`. The underlying table
  DDL was already owned by `apps/union-eyes/db/schema-organizations.ts` before
  and after the reclassification. No columns changed, no indexes changed, no
  FKs changed.
- §5 (`audit_events`) reclassified from `PLATFORM_OWNED_SHARED` →
  `PLATFORM_OWNED_EXCLUSIVE`. The table already had platform-only DDL before
  and after. No Django binding existed to remove.

The Option D contract therefore inherits from Phase 0B (established) and was
not touched by Phase 0B.2R §4 / §5. This §6 verification confirms that
inheritance.

## 8. What §6 does NOT do

- ✗ Does not re-run the full Phase 0B clean-composition proof (that is §10).
- ✗ Does not verify runtime resolver behaviour (that is §7).
- ✗ Does not verify that UE Cognition tables use UUID org IDs (that is §8).
- ✗ Does not add or modify any DDL.

## 9. Next section

§8 — Reconcile org ID types across UE Cognition (verify no accidental prefixed
text ID leakage into recent UE Cognition tables). §7 (runtime resolver
integration) follows §8 because §8 confirms the identifier surface §7 must
integrate against.
