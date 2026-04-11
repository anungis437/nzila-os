# Migration Index

> Centralized catalog of all database migrations, schema changes, and data import scripts across the NzilaOS monorepo.

**Last updated:** 2026-04-01

---

## Directory Structure

```
migrations/
├── INDEX.md                  ← this file
├── platform/                 ← shared platform-level SQL migrations
├── staging/
│   ├── union-eyes/           ← UnionEyes staging seeds & DDL (21 files)
│   ├── zonga/                ← Zonga staging seeds & DDL (3 files)
│   └── shared/               ← cross-app staging scripts (10 files)
apps/
├── union-eyes/db/migrations/ ← Drizzle-managed schema migrations (0000–0087+)
│   ├── manual/               ← hand-written RLS, triggers, feature patches
│   ├── compliance/           ← PCI-DSS, AML/KYC, ISO 27001
│   ├── rollback/             ← rollback scripts for manual migrations
│   └── meta/                 ← Drizzle journal + snapshots
├── abr/backend/*/migrations/ ← Django-managed (Python, auto-generated)
└── zonga/backend/*/migrations/ ← Django-managed (Python, auto-generated)
scripts/migrations/
├── agri/                     ← legacy Agrimo + Cora data import scripts (TypeScript)
└── trade/                    ← legacy Trade-OS + eExports data import scripts (TypeScript)
```

---

## 1. Platform Migrations (`migrations/platform/`)

Shared SQL migrations that apply to the platform-level database schema. Not tied to a specific app's Drizzle or Django lifecycle.

| File | Domain | Description |
|------|--------|-------------|
| `hash-chain-immutability-triggers.sql` | Integrity | INSERT/UPDATE/DELETE immutability triggers for `audit_events` + hash-chain validation |
| `ai-control-plane-pgvector.sql` | AI | pgvector extension + vector column setup for AI control plane RAG |
| `20260321080434_zonga-subscription-columns.sql` | Zonga | Subscription tier columns for Zonga commerce |
| `0004_add_co2_estimate_grams.sql` | AI / ESG | Adds `co2_estimate_grams NUMERIC(12,4)` to `ai_usage_budgets` (NZ-RISK-027) |

**How to apply:**
```bash
psql $DATABASE_URL -f migrations/platform/<file>.sql
```

---

## 2. UnionEyes — Drizzle Migrations (`apps/union-eyes/db/migrations/`)

Primary schema evolution managed by Drizzle Kit. **Do not edit these files directly.**

### Core (auto-generated)

| Range | Description |
|-------|-------------|
| `0000–0008` | Initial schema, phase 2, phase 5b, wage benchmarks |
| `0019–0025` | Drizzle schema updates, pilot enrollments |
| `0051–0058` | RLS policies (messaging, notifications, documents, reports, calendar), Clerk user ID alignment, FK constraints, world-class RLS |
| `0059–0065` | User ID conversion (phases B–F), visibility scopes, defensibility packs, immutability, audit archive, governance tables |
| `0066–0069` | Search vector cleanup, congress memberships, peer detection indexes, tenant→org rename |
| `0070–0078` | Organization users RLS, messaging/notifications/documents RLS, hierarchical RLS functions, claims RLS, dues transactions RLS |
| `0079–0087` | AI cost tracking, schema drift protection, critical indexes, pilot tables, data sources, claims decimal fix, monetization (phases 1–2), member location |

### Manual (`manual/`)

Hand-written SQL for features not handled by Drizzle's schema system (RLS policies, triggers, functions, feature flags, PII encryption). See [apps/union-eyes/db/migrations/README.md](../apps/union-eyes/db/migrations/README.md) for the full list.

### Compliance (`compliance/`)

| File | Standard |
|------|----------|
| `0001_pci_dss_compliance.sql` | PCI-DSS card data handling |
| `0002_aml_kyc_compliance.sql` | AML/KYC identity verification |
| `0003_iso27001_isms.sql` | ISO 27001 ISMS controls |

### Corrective

Ad-hoc schema alignment patches: `corrective-active-tables.sql`, `corrective-columns-p0.sql`, `corrective-full-sync.sql`, `corrective-platform-economics.sql`, `corrective-remaining-tables.sql`, `corrective-type-mismatches.sql`.

### Rollback (`rollback/`)

Reverse migrations for manual patches (0062–0065, 0080–0081).

**Drizzle commands:**
```bash
pnpm drizzle-kit generate   # generate from schema changes
pnpm drizzle-kit push        # push to database
pnpm drizzle-kit migrate     # run pending migrations
```

---

## 3. Staging Seeds & DDL (`migrations/staging/`)

**Not git-tracked** (excluded by `.gitignore`). Local-only scripts for populating staging/dev databases.

### UnionEyes (`staging/union-eyes/`) — 21 files

| File | Purpose |
|------|---------|
| `staging-analytics-seed.sql` | Analytics dashboard seed data |
| `staging-arb-inserts.sql` | Arbitration case seed records |
| `staging-assurance-seed.sql` | Quality assurance seed data |
| `staging-claims-all.sql` | Full claims dataset |
| `staging-claims-inserts.sql` | Claims INSERT statements |
| `staging-colinserts.sql` | Column-level INSERT batches |
| `staging-commerce-tables-migration.sql` | Commerce tables DDL |
| `staging-contributions-dues.sql` | Dues & contributions seed |
| `staging-cupe-sync.sql` | CUPE tenant sync data |
| `staging-entitlements.sql` | Member entitlements seed |
| `staging-eventbrite-integration.sql` | Eventbrite integration tables |
| `staging-grievance-inserts.sql` | Grievance case seed records |
| `staging-listener-org-nullable.sql` | Org nullable patch for listener |
| `staging-membership-tables.sql` | Membership tables DDL |
| `staging-ml-seed.sql` | ML training data seed |
| `staging-org-align.sql` | Organization alignment patch |
| `staging-orgmembers-dump.sql` | Organization members dump |
| `staging-orgmembers-inserts.sql` | Organization members INSERTs |
| `staging-podcasts-seed.sql` | Podcasts content seed |
| `staging-podcasts.sql` | Podcasts tables DDL |
| `staging-seed-local123.sql` | CUPE Local 123 tenant seed |

### Zonga (`staging/zonga/`) — 3 files

| File | Purpose |
|------|---------|
| `staging-seed-zonga.sql` | Zonga tenant seed data |
| `staging-zonga-ddl.sql` | Zonga DDL schema additions |
| `staging-zonga-world-class.sql` | Zonga world-class feature tables |

### Shared (`staging/shared/`) — 10 files

| File | Purpose |
|------|---------|
| `staging-ddl-missing.sql` | Missing DDL statements (cross-app) |
| `staging-deploy.sql` | Deployment-time schema patches |
| `staging-extra-seed-clean.sql` | Extra seed data (cleaned) |
| `staging-extra-seed.sql` | Extra seed data (raw) |
| `staging-migration.sql` | General migration script |
| `staging-schema.sql` | Full staging schema snapshot |
| `staging-seed-agrimo.sql` | Agrimo tenant seed data |
| `staging-seed-all.sql` | All-tenant seed bundle |
| `staging-seed.sql` | Default seed script |
| `staging-sync-data.sql` | Cross-table sync data |

**How to apply (native PostgreSQL):**
```powershell
$env:PGPASSWORD = "nzila_dev"
Get-Content migrations/staging/union-eyes/<file>.sql | & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U nzila -d nzila_automation -p 5433 -h localhost
```

---

## 4. Django Migrations (ABR & Zonga backends)

Standard Django auto-generated migrations. Managed by `python manage.py makemigrations` / `migrate`.

### ABR (`apps/abr/backend/`)

| Module | Migrations |
|--------|-----------|
| `ai_core` | 0001_initial |
| `analytics` | 0001_initial |
| `auth_core` | 0001_initial, 0002_audit_hash_chain |
| `billing` | 0001_initial |
| `compliance` | 0001_initial, 0002_compliance_org_seal, 0003_abr_identity_vault |
| `content` | 0001_initial |
| `core` | 0001_initial |
| `notifications` | 0001_initial |

### Zonga (`apps/zonga/backend/`)

| Module | Migrations |
|--------|-----------|
| `auth_core` | 0001_initial |
| `catalog` | (empty — `__init__.py` only) |
| `core` | (empty) |
| `creators` | (empty) |
| `events` | (empty) |
| `moderation` | (empty) |
| `payouts` | (empty) |
| `revenue` | (empty) |
| `rights` | (empty) |
| `subscriptions` | (empty) |

---

## 5. Data Import Scripts (`scripts/migrations/`)

TypeScript scripts for one-time legacy data imports. Not SQL migrations — these read archive files and write to the platform DB.

### Agri (`scripts/migrations/agri/`)

| Script | Source System | Idempotent |
|--------|-------------|------------|
| `import-agrimo-legacy.ts` | Agrimo (field ops) | ✅ |
| `import-cora-legacy.ts` | Cora Insights (analytics) | ✅ |
| `reconciliation-report.ts` | — | N/A |

### Trade (`scripts/migrations/trade/`)

| Script | Source System | Idempotent |
|--------|-------------|------------|
| `import-tradeos-core.ts` | Trade-OS (core platform) | ✅ |
| `import-eexports-vehicles.ts` | eExports (vehicle exports) | ✅ |
| `reconciliation-report.ts` | — | N/A |

---

## 6. Additional Seed Files

| Location | Description |
|----------|-------------|
| `apps/union-eyes/db/seeds/staging-*.sql` | UE-specific seed wrappers (rewards, governance, content/billing, schema sync) |
| `apps/flow/lib/seed-flow-staging.ts` | Flow app staging seed script |

---

## Conventions

1. **Drizzle migrations** — auto-generated, never hand-edit. Use `drizzle-kit generate`.
2. **Django migrations** — auto-generated via `makemigrations`. Hand-edit only for data migrations.
3. **Platform migrations** — hand-written SQL in `migrations/platform/`. Name with sequence number or date prefix.
4. **Staging seeds** — local-only, gitignored. Group by app in `migrations/staging/<app>/`.
5. **Manual UE migrations** — hand-written SQL in `apps/union-eyes/db/migrations/manual/`. Number sequentially (070+).
6. **Always test on staging before production.** Take a backup first.
