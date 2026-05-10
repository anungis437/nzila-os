# ORM Boundary: Django vs Drizzle

> **Canonical rule:** Django ORM is the source of truth for all `public` schema tables.
> Drizzle ORM provides type-safe read access for the Next.js frontend.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Django ORM (Python backend)                    │
│  ─ Canonical owner of public schema tables      │
│  ─ BaseModel provides: id (UUID PK),            │
│    created_at, updated_at                       │
│  ─ Migrations created via `manage.py`           │
│  ─ Staging/prod DB must be initialized by       │
│    Django migrations, NOT Drizzle               │
└──────────────────┬──────────────────────────────┘
                   │  mirrors
┌──────────────────▼──────────────────────────────┐
│  Drizzle ORM (Next.js frontend)                 │
│  ─ Read-only mirror of Django schemas           │
│  ─ drizzle.config.ts points to ue_cache only    │
│  ─ db/schema/domains/**  = mirrors of Django    │
│  ─ db/schema/*-schema.ts = legacy mirrors       │
│  ─ NEVER run `drizzle push` for public tables   │
└─────────────────────────────────────────────────┘
```

## PK Convention

Every table inherits `BaseModel` which adds:

- `id` — UUID, primary key, auto-generated
- `created_at` — timestamp, auto-set on insert
- `updated_at` — timestamp, auto-set on update

Other natural keys (e.g. `claim_id`, `member_id`) are UNIQUE constraints, not PKs.

## Adding or Modifying a Table

1. **Update Django model** in `apps/union-eyes/backend/<app>/models.py`
2. **Generate Django migration:** `python manage.py makemigrations`
3. **Mirror in Drizzle schema** in `apps/union-eyes/db/schema/domains/<domain>/`
4. **Run parity check:** `pnpm tsx tooling/db/dual-orm-parity-check.ts`
5. **Run canonical check:** `pnpm tsx tooling/db/canonical-schema/verify.ts`

## CI Gates

| Check | Script | What it verifies |
|-------|--------|-----------------|
| Canonical Schema | `tooling/db/canonical-schema/verify.ts` | Required columns exist in Drizzle files |
| Dual-ORM Parity | `tooling/db/dual-orm-parity-check.ts` | PK = `id`, Django model exists, no duplicate PKs |
| Schema Snapshot | `tooling/db/schema-snapshot.ts` | Drizzle schema files haven't drifted from snapshot |

## Root Cause of Historical Drift

In early 2026, staging was initialized via Drizzle migration 0083 instead of Django
migrations. This created tables with `claim_id` as PK (no `id` column), while local
dev (initialized by Django) had `id` as PK. The `20260327_staging_schema_alignment.sql`
migration corrects staging to match Django.

## Files

- Django models: `apps/union-eyes/backend/*/models.py`
- Drizzle schemas: `apps/union-eyes/db/schema/domains/`
- Drizzle config: `apps/union-eyes/drizzle.config.ts`
- Parity check: `tooling/db/dual-orm-parity-check.ts`
- Canonical manifest: `tooling/db/canonical-schema/manifest.json`
