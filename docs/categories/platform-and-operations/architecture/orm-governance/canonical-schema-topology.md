# Canonical Schema Topology

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

The authoritative map of who owns which schema in a Union Eyes database.

---

## 1. Topology at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Union Eyes PostgreSQL DB                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Django-owned (canonical)                 │   │
│  │  schemas: public.* (operational entities)                     │   │
│  │  migrations: apps/union-eyes/backend/<app>/migrations/        │   │
│  │  examples: organizations, users, unions, grievances, claims,  │   │
│  │            bargaining, billing, compliance, auth_core         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Drizzle-owned (scoped, runtime support)          │   │
│  │  schemas: ue_cache.*, ue_governance.*, ue_continuity.*,       │   │
│  │           ue_attestation.*, ue_telemetry.*                    │   │
│  │  migrations: apps/union-eyes/db/migrations-cache/             │   │
│  │  config:    apps/union-eyes/drizzle.config.ts                 │   │
│  │  barrel:    apps/union-eyes/db/schema-cache/cache.ts          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  Bootstrap-owned (extensions)                 │   │
│  │  CREATE EXTENSION: vector, uuid-ossp, pg_trgm, btree_gin,     │   │
│  │                    pgcrypto                                    │   │
│  │  owner: tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  FROZEN historical lineage                    │   │
│  │  apps/union-eyes/db/migrations/  (read-only archaeology)      │   │
│  │  see historical-migration-lineage-governance.md               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Ownership Zones

### 2.1 Django-owned (canonical operational)

- All canonical business entities.
- All operational workflows (grievances, claims, bargaining, etc.).
- All identity, organization, membership, billing, compliance entities.
- Lives under `public` schema today; future migrations may namespace
  per Django app.

### 2.2 Drizzle-owned (scoped runtime support)

- `ue_cache.*` — read-side cache projections.
- `ue_governance.*` — runtime governance event tables, governance
  attestation projections.
- `ue_continuity.*` — continuity/observability projections.
- `ue_attestation.*` — release evidence support tables.
- `ue_telemetry.*` — non-canonical telemetry buffers.

**Delegated read-model projections** (per [drizzle-scope-reconstruction.md](./drizzle-scope-reconstruction.md) §2):

- `public.icra_*` — Institutional Continuity Risk Assessment (continuity
  observability scope). Pseudonymous, no PII required, no Django model
  owns this surface. Tables: `icra_organizations`,
  `icra_assessments`, `icra_assessment_answers`, `icra_maturity_profiles`,
  `icra_continuity_scores`, `icra_governance_flags`,
  `icra_operational_indicators`, `icra_followup_recommendations`,
  `icra_benchmark_groups`, `icra_anonymized_metrics`.
  Registered via `apps/union-eyes/db/schema-cache/cache.ts` on
  2026-05-21. Fresh-DB bootstrap creates these via the scoped Drizzle
  migration lineage in `db/migrations-cache/`.

### 2.3 Bootstrap-owned (extensions only)

- `CREATE EXTENSION` statements for:
  - `vector` (pgvector)
  - `uuid-ossp`
  - `pg_trgm`
  - `btree_gin`
  - `pgcrypto`
- Any future extension must be added to
  `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` and to this
  list.

### 2.4 Frozen historical lineage

- `apps/union-eyes/db/migrations/` — read-only.
- Not part of any canonical authority.
- See [historical-migration-lineage-governance.md](./historical-migration-lineage-governance.md).

---

## 3. Operational Boundaries

| Boundary                                  | Allowed                                    | Prohibited                                          |
|-------------------------------------------|--------------------------------------------|-----------------------------------------------------|
| Drizzle reads Django entities             | yes (via select)                           | yes (no `ALTER` on Django entities from Drizzle)    |
| Django reads Drizzle cache projections    | yes (via select)                           | yes (no `ALTER` on Drizzle tables from Django)      |
| FK from Drizzle → Django                  | yes (`ON DELETE CASCADE`, documented)      | undocumented FKs                                    |
| FK from Django → Drizzle                  | **no**                                     | canonical may not depend on projection              |
| `CREATE EXTENSION` in Drizzle migration   | **no**                                     | bootstrap-only                                      |
| `CREATE EXTENSION` in Django migration    | **no**                                     | bootstrap-only                                      |

---

## 4. Migration Authority Paths

Three legitimate authority paths. Anything else is a violation.

```
┌─────────────────────────────────────────────────────────────────┐
│ Django entity change                                             │
│   → Django manage.py makemigrations <app>                        │
│   → reviewed in PR with `backend/<app>/migrations/` diff         │
│   → applied by Django migrate as part of canonical bootstrap     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Drizzle cache change                                             │
│   → edit apps/union-eyes/db/schema-cache/cache.ts                │
│   → pnpm --filter @nzila/union-eyes db:generate                  │
│   → reviewed in PR with db/migrations-cache/ diff                │
│   → applied by db:bootstrap                                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Extension addition                                               │
│   → edit run-union-eyes-drizzle-bootstrap.mjs REQUIRED_EXTENSIONS│
│   → reviewed in PR + topology update                             │
│   → applied by db:bootstrap                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Deployment Legitimacy Implications

A deployed environment is **topologically legitimate** when:

- Django migrations have applied cleanly to the canonical zone.
- `db:bootstrap` has applied cleanly: extensions installed, snapshot
  restored (if configured), scoped Drizzle migrations applied, and a
  bootstrap attestation written with `legacy_replay_override = false`.
- The runtime advertises `SECRET_TOPOLOGY` per
  [TSOSA](../../union-eyes/release/transitional-shared-secret-topology.md).

If any of those conditions is not met, the environment is operating
outside the canonical topology and must be flagged in the environment's
validation report.
