# 05 — Full Database & Migration Legitimacy

**Authority:** PG flexible-server enumeration + Drizzle migration ledger
inspection.

---

## 1. PostgreSQL Servers (live)

| Server                            | Region          | Version | RG                        |
|-----------------------------------|-----------------|---------|---------------------------|
| `nzila-staging-db`                | Canada Central  | 15      | `nzila-staging-rg`        |
| `nzila-os-union-eyes-demo-db`     | Canada Central  | 16      | `nzila-canada-demo-rg`    |

> **Honest gap:** Version skew (15 vs 16). Running same Drizzle migrations
> against PG 15 and PG 16 is generally safe but **not** identical
> (e.g., `random()`/`gen_random_uuid()` performance, `pg_stat_*` shape, JSON
> ops). Migration legitimacy must be proven on BOTH.

---

## 2. Drizzle Migration Ledger

The repo holds Drizzle migrations in `apps/union-eyes/drizzle/` and
schema in `apps/union-eyes/db/schema/`. Migration runner is invoked via
`pnpm --filter @nzila/union-eyes db:migrate` (postgres-js driver).

### 2.1 Verification posture

| Concern                            | Status |
|------------------------------------|--------|
| Migration files committed to repo  | LIVE |
| Migration ledger table (`__drizzle_migrations__`) on staging DB | UNVERIFIED in this audit (requires DB connect) |
| Migration ledger table on demo DB  | UNVERIFIED in this audit |
| Migration parity between staging+demo | UNVERIFIED |
| Drift detector run                 | NOT EXECUTED |

> **Operational honesty:** This audit captures topology truth, not row-level
> DB truth. Connecting to the live DB to enumerate the migrations table
> requires either a JIT connection from the operator's workstation OR
> running the verification from inside an ACA container with `PGPASSWORD`
> resolved from KV. **Not auto-executed.**

---

## 3. Required Extension Inventory

| Extension          | Purpose                            | Required on staging | Required on demo |
|--------------------|------------------------------------|--------------------|--------------------|
| `pgcrypto`         | `gen_random_uuid()`, sealing        | YES               | YES                |
| `vector` (pgvector)| AI cognition embeddings             | YES               | YES (if cognition surfaces are on) |
| `pg_trgm`          | Search                              | YES (if search active) | YES                |
| `citext`           | Case-insensitive emails             | YES               | YES                |
| `unaccent`         | Locale-aware search                 | OPTIONAL          | OPTIONAL           |

> **Gap:** Per-DB extension state is UNVERIFIED in this audit. Required
> follow-up: per-tier `SELECT extname, extversion FROM pg_extension;` snapshot.

---

## 4. Tenant / Org Integrity

Per the `union-eyes-database-audit` repo memory and live UE schema:
- All app-level data is `org_id`-scoped.
- `auth_user_sessions`, `users`, `organization_members` are tenant-keyed.
- Cross-org test (`cross-org-block.spec.ts`) is GREEN on staging fabric.

| Concern                             | Verdict |
|-------------------------------------|---------|
| `org_id` columns enforced           | LIVE   |
| Cross-org E2E containment           | LIVE   |
| RLS (Postgres row-level security)   | DEFERRED — app-layer scoping only |

---

## 5. Auth Integrity

| Concern                                            | Verdict |
|----------------------------------------------------|---------|
| `auth_user_sessions` table present on staging      | INFERRED LIVE (E2E green) |
| `auth_user_sessions` table present on demo         | UNVERIFIED |
| Argon2id hashes used                               | LIVE    |
| Session cleanup cron                               | DEFERRED |

---

## 6. Seed Integrity

| Tier    | Seed runner                                                      | Verdict |
|---------|-------------------------------------------------------------------|---------|
| local   | `pnpm --filter @nzila/union-eyes seed:test-env`                  | LIVE   |
| staging | manual operator action (gated)                                    | PARTIAL |
| demo    | NO seed runner detected                                           | MISSING |
| pilot   | `cupe-pilot-readiness.yml`                                        | LIVE (CI) |
| prod    | shares staging DB; no separate seed                               | n/a    |

---

## 7. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| DB1 | Run `SELECT * FROM __drizzle_migrations__ ORDER BY id;` on staging+demo and snapshot | YES (read-only) |
| DB2 | Snapshot `pg_extension` on both DBs                                | YES (read-only) |
| DB3 | Plan + execute PG 15 → 16 upgrade for staging                      | YES (HIGH risk) |
| DB4 | Add automated migration drift detector to CI                        | LOW (CI-only)  |
| DB5 | Provision demo seed runner (with consent flag)                     | YES |
| DB6 | Schedule periodic backup-restore drill                             | YES |

---

## 8. Findings

| # | Finding                                                          | Severity |
|---|------------------------------------------------------------------|----------|
| 1 | DB version skew (PG 15 vs 16)                                    | Medium   |
| 2 | Migration ledger UNVERIFIED in this audit                        | Medium   |
| 3 | Extension inventory UNVERIFIED in this audit                     | Medium   |
| 4 | RLS not enforced at PG layer (app-only scoping)                  | Medium   |
| 5 | Demo lacks seed runner                                            | Medium   |
| 6 | No automated migration drift detection                           | Medium   |

---

**Verdict for §5:** Database & migration legitimacy is **PARTIAL**. Topology
is captured truthfully; row-level verification (ledger + extensions) is
catalogued as required follow-up requiring operator DB-connect authorization.
