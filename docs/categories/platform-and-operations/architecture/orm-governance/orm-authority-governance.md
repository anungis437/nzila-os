# ORM Authority Governance

**Status:** Active — institutional canon
**Effective:** 2026-05-09
**Scope:** All Union Eyes (Nzila ecosystem) databases and ORM layers
**Owner:** Platform / Schema Governance

This document defines the canonical, institutional ORM authority model
for Nzila. It eliminates ambiguity about which ORM owns which schema,
who may evolve which entities, and where migration authority resides.

---

## 1. Statement of Canonical Ownership

Django is the canonical operational source-of-truth ORM for institutional
business entities.

Drizzle is restricted to runtime support, cache, governance, telemetry,
continuity, attestation, and operational projection schemas unless
explicitly delegated.

These two statements are the constitutional rules of the Nzila ORM
governance model. All other rules in this document derive from them.

---

## 2. Domain Ownership Matrix

| Domain                                   | Canonical Owner | Notes                                                       |
|------------------------------------------|-----------------|-------------------------------------------------------------|
| Core operational schema                  | Django          | unions, users, organizations, memberships                   |
| Canonical business entities              | Django          | grievances, claims, bargaining, billing, compliance, dues   |
| Cache / runtime support schema           | Drizzle         | `ue_cache.*` and equivalent edge projections                |
| Governance runtime schema                | Drizzle         | governance event tables, governance attestation tables      |
| Continuity observability schema          | Drizzle         | continuity probes, observability projections                |
| Attestation / evidence schema            | Drizzle         | release evidence, deployment attestations                   |
| Runtime support projections (read-models)| Drizzle         | derived projections used by Next.js routes                  |
| Telemetry support tables                 | Drizzle         | runtime telemetry buffers (non-canonical)                   |
| Postgres extensions (CREATE EXTENSION)   | Bootstrap       | owned by `db:bootstrap`, neither ORM declares them          |

Anything not listed here is presumed Django-owned. Adding a new domain
requires a PR that updates this matrix and the
[canonical schema topology](./canonical-schema-topology.md).

---

## 3. Migration Authority Boundaries

| Authority                                  | Owner   | Location                                                |
|--------------------------------------------|---------|---------------------------------------------------------|
| Django app migrations                      | Django  | `apps/union-eyes/backend/<app>/migrations/`             |
| Active Drizzle migrations (scoped)         | Drizzle | `apps/union-eyes/db/migrations-cache/`                  |
| Frozen Drizzle lineage (read-only)         | Frozen  | `apps/union-eyes/db/migrations/`                        |
| Extension installation                     | Bootstrap| `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` |
| Canonical snapshot restore                 | Bootstrap| `tooling/scripts/restore-union-eyes-snapshot.mjs`      |

A schema change that crosses authorities (e.g. a Django entity that needs
a Drizzle-side projection) is a **two-PR governance event**: one PR per
authority, each reviewed by the owning team.

---

## 4. Schema Evolution Authority

- Django entities may only be evolved by Django migrations.
- Drizzle entities may only be evolved by scoped Drizzle migrations
  generated from `db/schema-cache/cache.ts`.
- No ORM may evolve another ORM's tables. Drizzle migrations that
  `ALTER TABLE` Django-owned entities, or Django migrations that
  `ALTER TABLE` Drizzle-owned cache tables, are governance violations
  and must be rejected at review.

---

## 5. Replay Authority

- Django migrations are replayable in their canonical order; this is
  Django's standard contract.
- Scoped Drizzle migrations under `db/migrations-cache/` are replayable
  via `db:bootstrap`.
- The frozen Drizzle lineage under `db/migrations/` is **not**
  replayable on fresh databases. See
  [historical-migration-lineage-governance.md](./historical-migration-lineage-governance.md).

---

## 6. Extension Ownership

PostgreSQL extensions (`vector`, `uuid-ossp`, `pg_trgm`, `btree_gin`,
`pgcrypto`, etc.) are owned by the bootstrap orchestrator, not by any
ORM. Neither Django migrations nor Drizzle migrations may issue
`CREATE EXTENSION` statements in the canonical path. The current
required set is enumerated in `run-union-eyes-drizzle-bootstrap.mjs`.

---

## 7. Shared-Schema Prohibitions

- Drizzle MUST NOT define a table with the same logical purpose as a
  Django-owned canonical entity.
- Cache tables must namespace clearly (e.g. `ue_cache_*` prefix or a
  dedicated PostgreSQL schema) so they cannot be confused with canonical
  entities at read time.
- Foreign keys from Drizzle-owned cache tables to Django-owned canonical
  tables are permitted only as `ON DELETE CASCADE` projection links and
  must be documented in the canonical topology.
- Foreign keys from Django-owned canonical tables to Drizzle-owned
  cache tables are **prohibited** — canonical entities must not depend
  on projections.

---

## 8. Operational Attestation Implications

- Every `db:bootstrap` run writes a row to
  `drizzle.bootstrap_attestations` recording git sha, release id,
  environment, snapshot digest, and scoped migration count.
- Production environments must reject any deployment whose attestation
  records `legacy_replay_override = true`.
- Governance review may consult these attestations as the canonical
  evidence of how a given environment was materialized.

---

## 9. Enforcement

- `pnpm --filter @nzila/union-eyes db:validate` runs the static
  legitimacy validator (see
  [migration-legitimacy-validation-system.md](./migration-legitimacy-validation-system.md)).
- The bootstrap orchestrator refuses to replay frozen lineage at runtime.
- The Drizzle config is scoped to a single barrel
  (`db/schema-cache/cache.ts`); broad imports break review.

These three controls together are intended to make ambiguity-by-accident
impossible. Ambiguity-by-intent requires writing this document
differently, which is a governance event.
