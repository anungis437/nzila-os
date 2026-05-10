# Deployment Legitimacy Reconciliation

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [orm-authority-governance.md](./orm-authority-governance.md)

This document reconciles **deployment legitimacy** with **ORM
governance legitimacy**. They are related but distinct properties of
a running environment, and conflating them has caused operator
confusion in the past.

---

## 1. Two Independent Legitimacy Properties

### 1.1 Runtime legitimacy

The environment's compute layer is healthy: the Container App revision
is Healthy, ingress responds, the process reports the expected
release identity (`releaseId`, `gitSha`, `environment`), and basic
checks pass (process, database TCP).

### 1.2 Schema legitimacy

The environment's database has been materialized along a path that the
canonical ORM governance recognizes as authoritative: Django migrations
applied (canonical zone), `db:bootstrap` applied (extensions + scoped
Drizzle), bootstrap attestation written, and — for non-prod — a
canonical snapshot restored.

### 1.3 Why they're independent

- An environment can be **runtime-legitimate but schema-illegitimate**
  (the demo environment as of 2026-05-09 is exactly this state — see
  [`demo-environment-validation-report.md`](../../union-eyes/release/demo-environment-validation-report.md)).
- An environment can be schema-legitimate but runtime-illegitimate (e.g.
  schema is correct but the new revision crashes on startup).
- Both must be true for the environment to be release-legitimate.

---

## 2. Reconciliation Validations

| Property                   | Validation                                                                                  |
|----------------------------|---------------------------------------------------------------------------------------------|
| Runtime legitimacy         | Container App revision Healthy + `/api/health` 200 + correct release identity               |
| Schema legitimacy          | `drizzle.bootstrap_attestations` row exists with `legacy_replay_override = false`           |
| Migration legitimacy       | Django migration log present + scoped Drizzle journal applied                               |
| Replay legitimacy          | `legacy_replay_override = false` in latest attestation                                      |
| Attestation legitimacy     | Attestation row carries non-null `git_sha`, `release_id`, `environment`                     |
| Topology legitimacy        | `db:validate` passes against the deployed app's working tree                                |

---

## 3. Healthy Runtime ≠ Resolved Migration Legitimacy

This distinction is operationally important.

A demo or pilot environment can be brought to a healthy runtime state
(image pulls, container starts, DB TCP works) before the schema has
been materialized along a legitimate path. The `/api/health` endpoint
reports `database = ok` purely on TCP/credentials — it does not
attest that schema is canonical.

Therefore:

- A passing `/api/health` is **necessary but not sufficient** for
  release legitimacy.
- The bootstrap attestation row is the **schema legitimacy ground truth**.
- Validation reports must show both, and must explicitly distinguish
  them.

---

## 4. Reconciliation Procedure for Existing Environments

For an environment that is runtime-legitimate but schema-illegitimate
(e.g. demo as of 2026-05-09):

1. Operator selects bootstrap strategy per
   [environment-bootstrap-strategy.md](./environment-bootstrap-strategy.md).
2. If snapshot path: provision the snapshot in the environment's
   permitted snapshot source and set `UE_DB_RESTORE_SNAPSHOT_URL`.
3. Run `pnpm --filter @nzila/union-eyes db:bootstrap` against the
   environment's DB.
4. Verify `drizzle.bootstrap_attestations` has a new row with
   `legacy_replay_override = false`.
5. Update the environment's validation report with the attestation row
   id (or content hash) and re-run the validation checklist.

---

## 5. Production-Specific Reconciliation

Production environments may **never** be brought to schema legitimacy
via:

- Frozen lineage replay (forensic override or otherwise).
- Snapshot restore from a non-production source.
- Manual psql DDL outside the controlled deploy pipeline.

The only legitimate path to production schema legitimacy is:

1. Controlled `manage.py migrate` against production DB.
2. `db:bootstrap` against production DB.
3. Bootstrap attestation written with `legacy_replay_override = false`.

---

## 6. Output Required

Each environment's validation report must include a section that:

- States the runtime legitimacy result.
- States the schema legitimacy result.
- References the bootstrap attestation row.
- References the snapshot digest (where applicable).

This is the operational evidence reviewed at release-gate.
