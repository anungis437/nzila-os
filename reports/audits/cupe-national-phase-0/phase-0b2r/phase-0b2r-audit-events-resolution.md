# Phase 0B.2R §5 — `audit_events` Ownership Resolution

**Status:** RESOLVED (reclassification to `PLATFORM_OWNED_EXCLUSIVE`)
**Resolved by:** Aubert Nungisa
**Resolved at:** 2026-07-23
**Prior classification:** `PLATFORM_OWNED_SHARED` (foundational, `AUTO_CLASSIFIED_UNREVIEWED` — hard-fail open blocker)
**New classification:** `PLATFORM_OWNED_EXCLUSIVE` (foundational, `HUMAN_REVIEWED`)

---

## 1. Problem Statement

The Phase 0B.2R baseline manifest classified `audit_events` as
`PLATFORM_OWNED_SHARED`, implying a Django-side consumer that adopts the
platform-owned table via `managed=False`. Section §5 of the corrective-phase
mandate required either producing evidence of that Django consumer or
reclassifying the row.

Verbatim constraint: *"Do not retain PLATFORM_OWNED_SHARED without a second
runtime user."*

The two explicit options were:

- **Option A** — add an explicit Django `managed=False` model bound to
  `audit_events` (with tests) so `PLATFORM_OWNED_SHARED` becomes true.
- **Option B** — reclassify as `PLATFORM_OWNED_EXCLUSIVE`.

## 2. Discovery Evidence

### 2.1 Platform DDL exists and is extensive

Search of `packages/db/**` for `audit_events` returned 96 matches across 16
files. The platform side is the fully-owned author:

| Path                                                                                  | Role                                                                        |
|---------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| [packages/db/src/schema/operations.ts](../../../../packages/db/src/schema/operations.ts) §18            | Drizzle table definition                                                    |
| [packages/db/drizzle/0000_initial.sql](../../../../packages/db/drizzle/0000_initial.sql) L242           | Initial `CREATE TABLE "audit_events"`                                        |
| [packages/db/drizzle/0004_audit_events_immutable.sql](../../../../packages/db/drizzle/0004_audit_events_immutable.sql) | Immutability triggers                                                        |
| [packages/db/drizzle/0014_rename_actor_user_id.sql](../../../../packages/db/drizzle/0014_rename_actor_user_id.sql) | `actor_clerk_user_id → actor_user_id` rename                                 |
| [packages/db/drizzle/0032_audit_events_canonical_hash.sql](../../../../packages/db/drizzle/0032_audit_events_canonical_hash.sql) | Canonical hash-chain fields                                                  |
| [packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql](../../../../packages/db/drizzle/0036_heal_audit_events_canonical_hash.sql) | Healing migration                                                            |
| [packages/db/migrations/hash-chain-immutability-triggers.sql](../../../../packages/db/migrations/hash-chain-immutability-triggers.sql) | `trg_audit_events_hash_not_null` + supporting triggers                       |
| [packages/db/src/audit.ts](../../../../packages/db/src/audit.ts) L84                | `emitAuditEvent()` — platform emitter that writes to `audit_events`         |
| [packages/db/src/org-registry.ts](../../../../packages/db/src/org-registry.ts) L52  | Registered as `'auditEvents'` in the platform org registry                  |
| `packages/db/drizzle/meta/000{0-3}_snapshot.json`                                     | Drizzle snapshot state for `public.audit_events`                            |

This is a mature, hash-chained, immutable append-only audit table with
platform-side authoring, migration lineage, snapshot state, triggers, and a
governed emitter API.

### 2.2 No Django binding exists

Search of `apps/union-eyes/backend/**/*.py` for `audit_events|AuditEvent`
returned only **3 matches in 2 files**, none of which are `db_table` bindings:

1. [`apps/union-eyes/backend/auth_core/tasks.py`](../../../../apps/union-eyes/backend/auth_core/tasks.py) L34 — a
   **comment inside a Celery task** describing aspirational future work:

   ```python
   """Fire-and-forget audit log write.

   Currently writes to the structured logger (same output as the old
   synchronous middleware).  A future iteration can persist to the
   audit_events table without touching the middleware again.
   """
   ```

   This is a docstring hint, not a binding.

2. [`apps/union-eyes/backend/services/compliance_snapshot/service.py`](../../../../apps/union-eyes/backend/services/compliance_snapshot/service.py) L186–191 —
   a **local variable name** `audit_events_30d` that is populated by querying
   the UE-local `AuditLogs` model:

   ```python
   payload["audit_events_30d"] = AuditLogs.objects.filter(…).count()
   # AuditLogs → db_table = "audit_logs" (NOT audit_events)
   ```

   The variable name uses "audit_events" as a payload key for a downstream
   compliance report but the underlying query hits `audit_logs`, a completely
   different table.

3. There are **zero** Django models with `Meta.db_table = "audit_events"`.
   There are **zero** `SeparateDatabaseAndState` migrations adopting
   `audit_events`. There are **zero** ORM references to a Django
   `AuditEvents`/`AuditEvent` class.

### 2.3 Django's actual audit surface is a different table

The union-eyes app maintains its own tamper-evident audit chain in a
**separate table** called `audit_logs`:

- [`apps/union-eyes/backend/core/models.py`](../../../../apps/union-eyes/backend/core/models.py) L155 —
  `class AuditLogs(BaseModel)` with `db_table = "audit_logs"`, SHA-256 hash
  chain, indexes, admin registration, ViewSet, and 20+ callsites across the
  UE codebase.

The naming similarity between `audit_events` (platform) and `audit_logs`
(UE) is likely what led the baseline generator to infer a "shared" binding.
There is no such binding. They are two independent audit systems living in
two independent codebases writing to two independent tables.

### 2.4 UE writes to platform audit go through the emitter, not the ORM

Any UE code that needs to write into the platform's `audit_events` table does
so via the platform emitter in [`packages/db/src/audit.ts`](../../../../packages/db/src/audit.ts) (the
Drizzle-based `emitAuditEvent()` helper), not through the Django ORM. This
is a **governed cross-package write**, not a Django `managed=False` adoption.

## 3. Outcome

Reclassify `audit_events` as `PLATFORM_OWNED_EXCLUSIVE`.

| Field                  | Old value                                                              | New value                                                                       |
|------------------------|------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| `ownership`            | `PLATFORM_OWNED_SHARED`                                                | `PLATFORM_OWNED_EXCLUSIVE`                                                      |
| `ddl_owner`            | `platform`                                                             | `platform` (unchanged)                                                          |
| `target_schema`        | `public`                                                               | `public` (unchanged)                                                            |
| `foundational`         | `true`                                                                 | `true` (unchanged)                                                              |
| `platform_sources`     | `[]`                                                                   | 6 sources (schema, emitter, 4 migrations)                                       |
| `django_sources`       | `[]`                                                                   | `[]` (correctly empty — no Django binding)                                      |
| `review_status`        | `AUTO_CLASSIFIED_UNREVIEWED`                                           | `HUMAN_REVIEWED`                                                                |
| `open_blocker_reason`  | present                                                                | removed                                                                         |
| `classification_method`| `MANUAL`                                                               | `MANUAL`                                                                        |
| `evidence_sources`     | 2 audit-report links                                                   | 9 sources incl. this doc, schema, emitter, 4 migrations, trigger file           |

## 4. Why Option A was rejected

Adding a Django `managed=False` model for `audit_events` would:

- **Duplicate** the audit surface — Django already has its own `AuditLogs` /
  `audit_logs` with its own SHA-256 hash chain, indexes, admin, and
  ViewSet. UE code writes to it heavily.
- **Break the immutability contract** — the platform enforces
  append-only + hash-chain via `hash-chain-immutability-triggers.sql`. A
  Django adoption would need to route all writes through
  `emitAuditEvent()` anyway (bypassing the ORM), so the `managed=False`
  model would be inert.
- **Create ambiguity** — future UE contributors would see two audit models
  (`AuditLogs` and a new `AuditEvents`) and could not tell which to use.
- **Not clarify anything the emitter already handles** — cross-package writes
  from UE into the platform `audit_events` table already work through
  `packages/db/src/audit.ts`. That is the governed integration surface; a
  Django ghost model does not add value.

The mandate explicitly says: *"Do not retain PLATFORM_OWNED_SHARED without a
second runtime user."* Option B (reclassification) is the correct answer
because there is no second Django runtime user and there should not be one.

## 5. Files landed

| File                                                                                            | Change                                                                                              |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `scripts/audit/build-phase0b2-ownership-manifest.py`                                            | `EXTRA_MANIFEST_ENTRIES` entry for `audit_events` changed from `PLATFORM_OWNED_SHARED` to `PLATFORM_OWNED_EXCLUSIVE` with updated rationale. |
| `scripts/audit/enrich-phase0b2r-ownership-manifest.py`                                          | Removed from `FOUNDATIONAL_OPEN_BLOCKERS` (now empty). Added to `FOUNDATIONAL_HUMAN_REVIEWED` with 6 platform sources + 9 evidence sources. |
| `packages/db/schema-ownership-manifest.json`                                                    | Regenerated. Entry reflects new ownership + full HUMAN_REVIEWED provenance.                         |
| `reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-audit-events-resolution.md`         | This document.                                                                                      |

## 6. Validator output after §5

Before §5 (i.e. after §4): **2 errors** — both on `audit_events` (hard-fail
foundational unreviewed + empty source arrays).

After §5:

```
Schema ownership manifest is valid.
  Manifest version:           2
  Tables declared:            125
  Foundational slice size:    13
  OWNERSHIP_UNRESOLVED count: 0
  Ownership distribution:
    DJANGO_INTERNAL                    9
    PLATFORM_OWNED_EXCLUSIVE          14
    PLATFORM_OWNED_SHARED              2
    SAME_NAME_DIFFERENT_MEANING        2
    UNION_EYES_OWNED_EXCLUSIVE        96
    UNION_EYES_OWNED_SHARED            2
  Review status distribution:
    AUTO_CLASSIFIED_UNREVIEWED        90
    HUMAN_REVIEWED                    16
    OWNERSHIP_UNRESOLVED               0
    RULE_DERIVED_REVIEWED             19
  Deferred review count:      90
```

**Zero errors. Zero open foundational blockers.** All 13 foundational rows are
now HUMAN_REVIEWED with evidence sources.

## 7. Ownership count deltas

| Category                     | Before §5 | After §5 | Delta |
|------------------------------|-----------|----------|-------|
| `PLATFORM_OWNED_EXCLUSIVE`   | 13        | 14       | +1    |
| `PLATFORM_OWNED_SHARED`      | 3         | 2        | −1    |
| `HUMAN_REVIEWED`             | 15        | 16       | +1    |
| `AUTO_CLASSIFIED_UNREVIEWED` | 91        | 90       | −1    |
| Foundational open blockers   | 1         | 0        | −1    |

The remaining two `PLATFORM_OWNED_SHARED` entries (unchanged by §5) are:

1. `orgs` — genuine cross-schema contract (platform-side of the org
   identity contract; UE reads via `union_eyes.organizations.platform_tenant_id`).
2. `stripe_webhook_events` — genuine platform-owned Stripe webhook table
   adopted by Django via `billing/migrations/0002_adopt_platform_stripe_webhook_events.py`
   with a real Django model binding.

Both remaining `PLATFORM_OWNED_SHARED` entries have documented second runtime
users. The mandate's constraint is satisfied.

## 8. Test verification

- `pnpm exec vitest run --project tooling-checks` — will be re-run after §5
  commit; no rule changes were made, only manifest data updates, so the 18
  validator tests continue to pass.
- Generator + enricher pipeline remains idempotent (§3 property preserved —
  re-running the generator produces identical output).

## 9. What §5 does NOT do

- ✗ Does not add or remove any DDL.
- ✗ Does not modify any platform migration.
- ✗ Does not touch the `emitAuditEvent()` API surface.
- ✗ Does not modify Django `AuditLogs` (which continues to write to
  `audit_logs`, unrelated to this section).
- ✗ Does not change validator rules — the reclassification uses the existing
  §3 provenance rules.

## 10. Next section

§6 — re-verify the org cross-schema contract against the corrected manifest,
then §7 (runtime resolver integration) and beyond.
