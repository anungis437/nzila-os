# Disaster Recovery — Canonical Index

> This is the **canonical entrypoint** for disaster recovery in `nzila-os`. It does
> not define a new DR program; it points to the authoritative recovery, backup, and
> live-infrastructure evidence already maintained in the repository.

- **Last updated:** 2026-07-03
- **Production-readiness baseline commit:** `e01319325421cb25fc96c52b01f9dde498458aed`

## Source of truth

| Purpose | Authoritative document |
| --- | --- |
| Rollback / recovery procedure (revision + digest revert, DB PITR) | [runbooks/production-rollback.md](runbooks/production-rollback.md) |
| Backup + restore posture (30d retention, geo-redundant, ZR-HA, restore drill) | [readiness/backup-restore-certification.md](readiness/backup-restore-certification.md) |
| Live infrastructure state + rollback matrix | [nzila-infrastructure-convergence/final-live-infrastructure-certification.md](nzila-infrastructure-convergence/final-live-infrastructure-certification.md) |
| Canonical production verdict | [readiness/production-certification.md](readiness/production-certification.md) |

## Recovery posture (as certified)

- **Database:** `nzila-os-union-eyes-prod-db` (Postgres 16) — 30-day PITR,
  geo-redundant backup, Zone-redundant HA; restore-drill server verified.
  Detail: [readiness/backup-restore-certification.md](readiness/backup-restore-certification.md).
- **Compute:** production Container Apps are digest-pinned; rollback to a prior
  known-good revision/digest is the recovery path.
  Detail: [runbooks/production-rollback.md](runbooks/production-rollback.md).

## Notes (honest gaps)

- A dedicated `docs/readiness/live-readiness-evidence.md` referenced in earlier
  planning does **not** exist. Live-readiness is instead verified by the executable
  gate `pnpm validate:live-readiness` and documented in
  [nzila-infrastructure-convergence/final-live-infrastructure-certification.md](nzila-infrastructure-convergence/final-live-infrastructure-certification.md).
  No claim beyond those is made here.
