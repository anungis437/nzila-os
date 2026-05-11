# Master ORM Governance Index

**Status:** Active
**Effective:** 2026-05-09
**Owner:** Platform / Schema Governance

This is the canonical entry point to the Nzila ORM governance program.
Read this first; then descend into the specific document for the
question at hand.

---

## 1. Constitutional Rules

> Django is the canonical operational source-of-truth ORM for
> institutional business entities.
>
> Drizzle is restricted to runtime support, cache, governance,
> telemetry, continuity, attestation, and operational projection
> schemas unless explicitly delegated.

Source: [orm-authority-governance.md](./orm-authority-governance.md)

---

## 2. Document Map

### Authority

- [orm-authority-governance.md](./orm-authority-governance.md) —
  the constitutional document; ownership matrix, boundaries, replay
  authority, extension ownership, prohibitions.
- [django-canonical-authority-formalization.md](./django-canonical-authority-formalization.md) —
  formalization of Django as the canonical operational ORM.
- [drizzle-scope-reconstruction.md](./drizzle-scope-reconstruction.md) —
  reconstruction of Drizzle into a scoped, governance-safe ORM.

### Topology

- [canonical-schema-topology.md](./canonical-schema-topology.md) —
  the authoritative ownership map across schemas.

### Lineage

- [historical-migration-lineage-governance.md](./historical-migration-lineage-governance.md) —
  the freeze of the pre-reconciliation Drizzle lineage and its
  read-only future.

### Bootstrap

- [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md) —
  per-environment bootstrap matrix and snapshot policy.
- [fresh-database-bootstrap-reference-implementation.md](./fresh-database-bootstrap-reference-implementation.md) —
  the canonical reference implementation: orchestrator, restore
  interface, attestation schema.

### Replay & Execution

- [migration-execution-governance.md](./migration-execution-governance.md) —
  who may execute migrations, when, and through which entrypoints.

### Legitimacy & Validation

- [deployment-legitimacy-reconciliation.md](./deployment-legitimacy-reconciliation.md) —
  the distinction between runtime and schema legitimacy.
- [migration-legitimacy-validation-system.md](./migration-legitimacy-validation-system.md) —
  the static validator and its evolution roadmap.

### Runtime Governance Attachment

- [governance-attachment-to-orm-authority.md](./governance-attachment-to-orm-authority.md) —
  how governance systems attach to canonical authority safely.
- [orm-authority-runtime-governance-attachment.md](./orm-authority-runtime-governance-attachment.md) —
  how runtime governance must reflect canonical ORM ownership.

### Readiness

- [orm-governance-readiness-review.md](./orm-governance-readiness-review.md) —
  current maturity of each governance dimension and unresolved risks.

---

## 3. Implementation Surface

| Area                                        | Location                                                              |
|---------------------------------------------|-----------------------------------------------------------------------|
| Scoped Drizzle config                       | `apps/union-eyes/drizzle.config.ts`                                   |
| Scoped Drizzle barrel                       | `apps/union-eyes/db/schema-cache/cache.ts`                            |
| Scoped Drizzle migration root               | `apps/union-eyes/db/migrations-cache/`                                |
| Frozen historical lineage                   | `apps/union-eyes/db/migrations/` (sentinel: `.lineage-frozen`)        |
| Bootstrap orchestrator                      | `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`                |
| Snapshot restore interface                  | `tooling/scripts/restore-union-eyes-snapshot.mjs`                     |
| Legitimacy validator                        | `tooling/scripts/validate-orm-legitimacy.mjs`                         |
| Legacy migrate (forensic-only)              | `tooling/scripts/run-union-eyes-drizzle-migrate.mjs`                  |

---

## 4. Operator Quick Reference

```bash
# Static governance checks
pnpm --filter @nzila/union-eyes db:validate

# Bootstrap a fresh DB (extensions + scoped migrate + attestation)
pnpm --filter @nzila/union-eyes db:bootstrap

# Generate a new scoped Drizzle migration from cache.ts
pnpm --filter @nzila/union-eyes db:generate

# Snapshot restore (operator-wired per environment)
UE_DB_RESTORE_SNAPSHOT_URL=... pnpm --filter @nzila/union-eyes db:restore

# Forensic-only: legacy lineage replay (NEVER in CI/CD/prod)
UE_LINEAGE_REPLAY_OVERRIDE=1 \
  UE_LINEAGE_REPLAY_REASON="incident-1234 lineage archaeology" \
  pnpm --filter @nzila/union-eyes db:migrate:legacy
```

---

## 5. Decision Tree

> "I need to add a new business entity."
> → Django app `models.py` + `manage.py makemigrations`. Do **not** add
>   to `cache.ts`.

> "I need a read-side cache for an existing canonical entity."
> → Add to `cache.ts`, run `db:generate`, review with topology update.

> "I need to install a new Postgres extension."
> → Add to `REQUIRED_EXTENSIONS` in `run-union-eyes-drizzle-bootstrap.mjs`.
>   Update topology + this index.

> "Demo DB is empty after provisioning."
> → `pnpm db:bootstrap` with `UE_DB_RESTORE_SNAPSHOT_URL` set to the
>   canonical staging snapshot.

> "Old migration replay broke."
> → That is by design. See historical-migration-lineage-governance.md.
>   Do not patch frozen migrations; bootstrap from snapshot instead.
