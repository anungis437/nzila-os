# Fresh Database Bootstrap — Reference Implementation

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document is the canonical reference for materializing a Union
Eyes database from scratch in a way that is deterministic, governable,
and free of historical migration archaeology.

---

## 1. Components

The reference implementation has three components:

| Component                                                          | Location                                                          | Role                                                          |
|--------------------------------------------------------------------|-------------------------------------------------------------------|---------------------------------------------------------------|
| Bootstrap orchestrator                                             | `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`            | Extensions + scoped Drizzle migrate + attestation             |
| Snapshot restore interface                                         | `tooling/scripts/restore-union-eyes-snapshot.mjs`                 | Canonical snapshot restore (snapshot source = operator-chosen)|
| Legitimacy validator                                                | `tooling/scripts/validate-orm-legitimacy.mjs`                     | Static checks against the governance contract                 |

---

## 2. Bootstrap Sequence

```
$ pnpm --filter @nzila/union-eyes db:validate    # static governance checks
$ pnpm --filter @nzila/union-eyes db:bootstrap   # extensions + restore + scoped migrate + attestation
```

Internally `db:bootstrap` performs:

1. Connectivity check against `DATABASE_URL`.
2. Replay-refusal assertion (sentinel + override gating).
3. `CREATE EXTENSION IF NOT EXISTS` for the required set:
   `vector`, `uuid-ossp`, `pg_trgm`, `btree_gin`, `pgcrypto`.
4. If `UE_DB_RESTORE_SNAPSHOT_URL` is set, delegate to
   `restore-union-eyes-snapshot.mjs`.
5. Apply scoped Drizzle migrations from `db/migrations-cache/` using
   the `meta/_journal.json` order.
6. Insert a row into `drizzle.bootstrap_attestations` with:
   - `git_sha`, `release_id`, `environment`
   - `snapshot_digest` (sha256 of restore URL)
   - `scoped_migrations_applied`
   - `legacy_replay_override`, `legacy_replay_reason`
   - full `payload` jsonb

---

## 3. Required Environment Variables

| Variable                       | Required for                                          | Notes                                                       |
|--------------------------------|--------------------------------------------------------|-------------------------------------------------------------|
| `DATABASE_URL`                 | always                                                 | Postgres connection string                                  |
| `UE_DB_RESTORE_SNAPSHOT_URL`   | demo, pilot, staging restores                          | URL scheme: `https`, `azure`, `file`                        |
| `GIT_SHA`                      | recommended (CI sets it)                               | Recorded in attestation                                     |
| `RELEASE_ID`                   | recommended (CI sets it)                               | Recorded in attestation                                     |
| `UE_ENVIRONMENT` / `NZILA_MODE`| recommended                                            | Recorded in attestation                                     |
| `UE_LINEAGE_REPLAY_OVERRIDE`   | forensic only                                          | If set, also requires `UE_LINEAGE_REPLAY_REASON`           |
| `UE_LINEAGE_REPLAY_REASON`     | forensic only                                          | Non-trivial string; logged                                  |

---

## 4. Supported Snapshot Sources

The restore interface today recognizes three URL schemes:

| Scheme          | Restore mechanism (operator-wired)                           |
|-----------------|---------------------------------------------------------------|
| `https://...`   | curl/wget + `pg_restore` from local download                  |
| `azure://...`   | `az storage blob download` + `pg_restore` (or psql for `.sql`)|
| `file:///...`   | `pg_restore` (or psql for `.sql`)                             |

The current `restore-union-eyes-snapshot.mjs` validates the URL but
does not perform the restore. Each environment's restore command must
be wired by the operator and reviewed in PR. This is intentional:
the script must not silently invent a restore mechanism.

---

## 5. Bootstrap Attestation Schema

```sql
CREATE TABLE drizzle.bootstrap_attestations (
  id                          SERIAL PRIMARY KEY,
  attested_at                 timestamptz NOT NULL DEFAULT now(),
  git_sha                     text,
  release_id                  text,
  environment                 text,
  snapshot_digest             text,
  scoped_migrations_applied   integer,
  legacy_replay_override      boolean,
  legacy_replay_reason        text,
  payload                     jsonb
);
```

This table is owned by the bootstrap orchestrator and lives in the
`drizzle` schema namespace alongside `__drizzle_migrations`.

---

## 6. Verification

After bootstrap, verify:

```sql
SELECT id, attested_at, environment, release_id,
       snapshot_digest, scoped_migrations_applied,
       legacy_replay_override
FROM drizzle.bootstrap_attestations
ORDER BY id DESC
LIMIT 1;
```

The most recent row must show:

- `legacy_replay_override = false`
- `environment` matching the deploy target
- `release_id` and `git_sha` matching the deployed image
- For demo/pilot/staging: non-null `snapshot_digest`

---

## 7. Determinism

The bootstrap is deterministic in the sense that, for fixed inputs
(`DATABASE_URL`, `UE_DB_RESTORE_SNAPSHOT_URL`, scoped journal,
extension list), the resulting schema and the resulting attestation
row content are reproducible. The `attested_at` timestamp is the
expected source of non-determinism.

This is deliberate: the bootstrap must look the same on every
environment given the same inputs, so that legitimacy reasoning is
portable.
