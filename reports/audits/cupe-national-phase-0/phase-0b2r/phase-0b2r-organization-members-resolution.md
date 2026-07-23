# Phase 0B.2R §4 — `organization_members` Ownership Resolution

**Status:** RESOLVED (Option B — reclassification)
**Resolved by:** Aubert Nungisa
**Resolved at:** 2026-07-23
**Prior classification:** `PLATFORM_OWNED_SHARED` (foundational, `AUTO_CLASSIFIED_UNREVIEWED` — hard-fail open blocker)
**New classification:** `UNION_EYES_OWNED_SHARED` (foundational, `HUMAN_REVIEWED`)

---

## 1. Problem Statement

The Phase 0B.2R baseline ownership manifest classified `organization_members` as
`PLATFORM_OWNED_SHARED` with `ddl_owner = "platform"` and
`target_schema = "public"`. Section §4 of the corrective-phase mandate required
resolving this row with an evidence-backed outcome because the manifest baseline
was demonstrably wrong: the migration meant to "adopt" the platform-owned table
(`apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py`)
referenced a platform DDL that does not exist.

The three explicit options were:

- **Option A** — add a platform DDL forward migration so `PLATFORM_OWNED_SHARED`
  becomes true.
- **Option B** — reclassify the row to match reality: the union-eyes app is the
  actual DDL owner; Django adopts it read-only via `managed=False`.
- **Option C** — `LEGACY_DEPRECATE` and remove the adoption migration.

Verbatim constraint from the mandate: *"Do not create an empty table merely to
satisfy the manifest."*

## 2. Discovery Evidence

### 2.1 No platform DDL exists

Search of `packages/db/**` for `organization_members`:

```
$ Select-String -Path packages/db -Pattern 'organization_members' -Recurse
# → 0 results
```

The platform database package (`packages/db/`) contains **zero references** to
this table — no Drizzle schema, no SQL migration, no CREATE TABLE statement.

### 2.2 Actual DDL owner: union-eyes app-local Drizzle

The physical table is defined in [apps/union-eyes/db/schema-organizations.ts](../../../../apps/union-eyes/db/schema-organizations.ts):

```ts
// apps/union-eyes/db/schema-organizations.ts (line 285)
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    organizationId: text('organization_id').notNull(),
    // …26 more columns including membership_number, member_category enum,
    // exempt_from_per_capita, search_vector, timestamps, indexes.
  },
  (table) => ({
    orgIdIdx: index('idx_organization_members_org_id').on(table.organizationId),
    userIdIdx: index('idx_organization_members_user_id').on(table.userId),
    uniqueMembership: uniqueIndex('unique_org_membership').on(
      table.organizationId,
      table.userId,
    ),
  }),
);
```

The Drizzle schema lives **inside the union-eyes app** (`apps/union-eyes/db/`),
not in the platform package (`packages/db/`). By the manifest's own ownership
rules, this makes the table **UE-owned**, not platform-owned.

### 2.3 Django read-only adoption

[apps/union-eyes/backend/auth_core/models.py](../../../../apps/union-eyes/backend/auth_core/models.py) (line 726) declares:

```python
class OrganizationMembers(BaseModel):
    # Migrated from drizzle: organization-members-schema.ts

    user_id = models.TextField()
    organization = models.ForeignKey(
        "auth_core.Organizations",
        on_delete=models.CASCADE,
        related_name="organization_members_organization_set",
    )
    role = models.TextField()
    status = models.TextField()
    # …fields mirroring the Drizzle schema

    class Meta:
        db_table = 'public"."organization_members'  # schema-qualified via injection trick
        managed = False
```

The migration history that produces this state:

1. [`auth_core/migrations/0001_initial.py`](../../../../apps/union-eyes/backend/auth_core/migrations/0001_initial.py) line 894 — `CreateModel("OrganizationMembers", …, db_table="organization_members")`.
2. [`auth_core/migrations/0004_adopt_platform_organization_members.py`](../../../../apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py) — state-only `SeparateDatabaseAndState` that runs `AlterModelTable` to `'public"."organization_members'` and `AlterModelOptions(managed=False)`. `database_operations=[]` means no DDL is emitted.

The Django side is a legitimate read-write consumer of the same physical table
that the union-eyes Drizzle schema defines. Since both consumers live inside the
same app (`apps/union-eyes/`), the table has one true owner (Union Eyes) and no
cross-package ownership contract is required.

### 2.4 Runtime users

Drizzle-side (writes and reads):
- [`apps/union-eyes/actions/analytics-actions.ts`](../../../../apps/union-eyes/actions/analytics-actions.ts) line 42 — `rlsDb.query.organizationMembers.findFirst(...)`
- [`apps/union-eyes/actions/rewards-actions.ts`](../../../../apps/union-eyes/actions/rewards-actions.ts) line 42 — same pattern
- Multiple admin `.tsx` pages under `apps/union-eyes/app/[locale]/(dashboard)/…`
- Seed SQL under `apps/union-eyes/db/seeds/`

Django-side (ORM reads/writes):
- `auth_core.OrganizationMembers` model, admin, serializers, ViewSets, tests
- [`apps/union-eyes/backend/unions/models.py`](../../../../apps/union-eyes/backend/unions/models.py) line 784 — `ForeignKey("auth_core.OrganizationMembers", …)`

Both sides target the same physical table (`public.organization_members`) via
different query languages. This is the textbook `UNION_EYES_OWNED_SHARED`
pattern.

## 3. Outcome — Option B

Reclassify `organization_members` as `UNION_EYES_OWNED_SHARED`.

| Field                  | Old value                                      | New value                                               |
|------------------------|------------------------------------------------|---------------------------------------------------------|
| `ownership`            | `PLATFORM_OWNED_SHARED`                        | `UNION_EYES_OWNED_SHARED`                               |
| `ddl_owner`            | `platform`                                     | `union_eyes`                                            |
| `target_schema`        | `public`                                       | `union_eyes` (physical relocation deferred to Wave 1)   |
| `foundational`         | `true`                                         | `true` (unchanged)                                      |
| `platform_sources`     | `[]`                                           | `[]` (unchanged — no platform DDL exists)               |
| `django_sources`       | `[]`                                           | 3 auth_core sources (see manifest)                      |
| `review_status`        | `AUTO_CLASSIFIED_UNREVIEWED`                   | `HUMAN_REVIEWED`                                        |
| `open_blocker_reason`  | present                                        | removed                                                 |
| `classification_method`| `MANUAL`                                       | `MANUAL`                                                |
| `evidence_sources`     | 2 audit-report links                           | 6 sources including this doc, Drizzle DDL, models.py, 2 migrations |

## 4. Why Option A was rejected

Option A ("add a platform DDL forward migration") would violate the mandate's
verbatim constraint: *"Do not create an empty table merely to satisfy the
manifest."* The UE app already owns a fully populated table with 30+ fields,
indexes, a search vector, and per-capita exemption logic. Introducing a
platform-side DDL would either (a) duplicate the schema in `packages/db/` with
no runtime user on the platform side, or (b) require moving all UE-app logic
into the platform package — a re-architecture explicitly out of Phase 0B.2R
scope.

## 5. Why Option C was rejected

Option C (`LEGACY_DEPRECATE`) is inappropriate: `organization_members` is
actively read and written by both the Drizzle and Django halves of the union-eyes
app across analytics, rewards, admin, and seed workflows. It is foundational to
UE org resolution, referenced by cross-schema FKs (e.g.
`apps/union-eyes/backend/unions/models.py:784`). Deprecating it would break UE
Wave 0 and Wave 1 functionality.

## 6. Disposition of migration `0004_adopt_platform_organization_members.py`

The migration is **retained in place** with a **corrected docstring**. The
filename itself is preserved because:

- The migration has already been applied to the staging database
  (`nzila-staging-db`) and any dev environments running `python manage.py
  migrate`.
- Renaming an applied Django migration file requires coordinated
  `django_migrations` table fixes across every environment — well outside
  Phase 0B.2R scope.
- The migration's runtime effect (`AlterModelTable` + `AlterModelOptions
  managed=False`) is still correct: it aligns Django state with the model
  `Meta.db_table` and prevents `makemigrations` drift.

The docstring at the top of the migration file has been rewritten to reflect
the corrected understanding — it now explicitly states that the union-eyes app
is the DDL owner, not the platform, and links back to this resolution doc.

## 7. Physical schema relocation (deferred)

The manifest now declares `target_schema = "union_eyes"` for
`organization_members`, matching the ownership. The **physical** relocation
from `public` → `union_eyes` schema is deferred to CUPE Wave 1 because:

- Multiple Drizzle files, admin pages, and seed scripts reference the table
  via its current `public` location.
- Django's `db_table='public"."organization_members'` literal must change in
  lock-step with the physical move.
- Data movement + FK re-pointing + downtime plan are all Wave 1 concerns.

Phase 0B.2R §4 completes the **manifest repair** only. The Wave 1 execution
plan will inherit `target_schema = "union_eyes"` as its target state.

## 8. Files landed

| File                                                                                              | Change                                                                                              |
|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `scripts/audit/build-phase0b2-ownership-manifest.py`                                              | Moved `organization_members` from rule 7 (removed) into `UNION_EYES_OWNED_SHARED` dict (rule 5).    |
| `scripts/audit/enrich-phase0b2r-ownership-manifest.py`                                            | Removed from `FOUNDATIONAL_OPEN_BLOCKERS`; added to `FOUNDATIONAL_HUMAN_REVIEWED` with 6 evidence sources. |
| `apps/union-eyes/backend/auth_core/migrations/0004_adopt_platform_organization_members.py`        | Docstring rewritten. Runtime behaviour unchanged.                                                   |
| `packages/db/schema-ownership-manifest.json`                                                      | Regenerated. New `UNION_EYES_OWNED_SHARED` entry replaces prior `PLATFORM_OWNED_SHARED` row.        |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-organization-members-resolution.md`   | This document.                                                                                      |

## 9. Validator output after §4

Before §4: 4 errors (2 blockers × 2 rules each — `organization_members` and `audit_events`).

After §4:

```
Schema ownership manifest FAILED validation:
  ✗ table "audit_events": foundational row has review_status="AUTO_CLASSIFIED_UNREVIEWED" — hard fail. …
  ✗ table "audit_events": platform_sources[] and django_sources[] are both empty (EXTRA-generator weakness)

2 error(s).
```

Only `audit_events` remains as an open foundational blocker. Resolving §5 will
bring the validator to zero errors.

## 10. Test verification

- `pnpm exec vitest run --project tooling-checks` → **18/18 passing** (385ms).
  No test changes required: the reclassification is a data update, not a rule
  change.
- Regenerator + enricher pipeline is idempotent per Phase 0B.2R §3 (verified by
  re-running `python scripts/audit/build-phase0b2-ownership-manifest.py` twice
  — second run produces identical output).

## 11. Ownership count deltas

| Category                     | Before §4 | After §4 | Delta |
|------------------------------|-----------|----------|-------|
| `PLATFORM_OWNED_SHARED`      | 3         | 3        | 0     |
| `UNION_EYES_OWNED_SHARED`    | 1         | 2        | +1    |
| `HUMAN_REVIEWED`             | 14        | 15       | +1    |
| `AUTO_CLASSIFIED_UNREVIEWED` | 92        | 91       | −1    |
| Foundational open blockers   | 2         | 1        | −1    |

*Note: the pre-§4 `PLATFORM_OWNED_SHARED` count was 4 in the raw generator
output before enrichment; enrichment did not change ownership, only
`review_status`. After §4 the base generator produces the corrected count of 3.*

## 12. What §4 does NOT do

- ✗ Does not physically move the table from `public` → `union_eyes` schema
  (deferred to CUPE Wave 1).
- ✗ Does not rename `0004_adopt_platform_organization_members.py` (already
  applied to live DBs).
- ✗ Does not add or remove any DDL or database rows.
- ✗ Does not change validator rules 11–17 introduced in Phase 0B.2R §3.

## 13. Next section

§5 — resolve `audit_events` (last remaining foundational open blocker).
