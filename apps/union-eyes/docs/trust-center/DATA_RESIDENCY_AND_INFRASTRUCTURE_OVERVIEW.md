# Union Eyes — Data Residency and Infrastructure Overview

> **Audience:** Procurement reviewers, privacy officers, institutional buyers.
> **Scope:** Public-safe summary of Union Eyes infrastructure topology and data residency posture.
> **Caveats:** Claims use language such as "is designed to," "supports," and "provides evidence of."
> Specific infrastructure provider details are available under NDA to qualified buyers.

---

## 1. Infrastructure Architecture

Union Eyes is a Next.js application built on a PostgreSQL-backed data layer, deployed within
a managed cloud infrastructure. The platform is designed for single-tenant or controlled
multi-tenant deployments in pilot mode.

**Key infrastructure characteristics:**

- **Database:** PostgreSQL with Drizzle ORM. All schema changes are managed through versioned
  migrations with SHA-256 lineage tracking.
- **Authentication:** Server-side session management. No client-side credential storage.
- **File storage:** Object storage (provider configurable) for document attachments. No
  uncontrolled public access to stored files.
- **Email/notifications:** Managed through configurable provider integrations.
- **Background processing:** Queue-based job processing for long-running operations.

*Supporting evidence:*
- `docs/operations/PRODUCTION_TOPOLOGY.md` — infrastructure topology documentation
- `docs/operations/PHASE_A_PRODUCTION_INFRA_VALIDATION.md` — infrastructure validation evidence

---

## 2. Data Residency

Union Eyes is designed to support data residency configurations appropriate for Canadian
labour organisations.

- Database deployment is configurable to Canadian cloud regions.
- No mandatory data transfer to jurisdictions outside the configured deployment region.
- Data residency requirements specific to a buyer's jurisdiction should be discussed
  during procurement.

---

## 3. Database Integrity

- All database migrations are tracked through a SHA-256 lineage manifest (`MANIFEST.md`).
- Migration timestamps and ordering are validated to prevent future-dated or duplicate migrations.
- The migration history is auditable by independent reviewers.

*Supporting evidence:*
- `apps/union-eyes/MANIFEST.md` — SHA-256 migration manifest
- `migrations/` — versioned migration SQL files

---

## 4. Backup and Recovery

Backup and restore procedures have been documented and rehearsed.

*Supporting evidence:*
- `docs/security/BACKUP_RESTORE_VALIDATION.md` — DR validation evidence
- `docs/operations/ROLLBACK_VALIDATION.md` — rollback procedure evidence

---

## 5. Infrastructure Posture Summary

| Dimension | Posture |
|-----------|---------|
| Database schema integrity | ✅ SHA-256 migration manifest |
| Tenant data isolation | ✅ Org-scoped all data paths |
| Backup/restore evidence | ✅ Documented and rehearsed |
| Infrastructure topology documentation | ✅ Present |
| Canadian region deployment support | ✅ Configurable |

---

*See also: [SECURITY_AND_PRIVACY_OVERVIEW.md](./SECURITY_AND_PRIVACY_OVERVIEW.md)*
