# Round 58D — Canonical Database Topology

Full structured data: [union-eyes-canonical-database-topology-round58d.json](./union-eyes-canonical-database-topology-round58d.json).

## Architectural decision

**ONE canonical Union Eyes Azure PostgreSQL data plane.** `services/financial-service` remains a separate process/microservice, but that is a *service* boundary, not a *database* boundary — no concrete deployed-infrastructure evidence was found requiring a physically separate database, and the mandate's own presumption (service isolation via role/schema/RLS/grants, not a second database) governs by default.

**`SAME_CANONICAL_DATABASE = YES`** (by architectural decision — financial-service has no live deployment of any kind today, so there is no live physical database to compare against; when it is deployed, it must connect to the canonical database).

## Evidence

- financial-service's real runtime DB bootstrap (`services/financial-service/src/db/index.ts`) is a plain `postgres` package connection against `process.env.DATABASE_URL` — a fully generic connection string, zero Supabase SDK usage at runtime, despite `@supabase/supabase-js` being a declared (now-removed) dependency.
- No Dockerfile, no `docker-compose` service entry, no Azure deploy workflow, and no `infrastructure/**` Bicep/Terraform resource exists for financial-service anywhere in the repository. Its only CI presence (`.github/workflows/cupe-pilot-readiness.yml`'s `financial-service-health` job) runs only typecheck/lint/test — never a real migration apply or deployment.
- **Conclusion: financial-service is completely undeployed today.**

## Supabase purge

Before: 2 real runtime SDK imports (`lib/services/pci-compliance-service.ts` + its test), 2 production package dependencies, 3 optional-but-validated `SUPABASE_*` env vars, a hardcoded real Supabase project connection string in `services/financial-service/.env.example`, a CSP allowlist entry, and one fully dead file (`lib/db-adapter.ts`) with fictitious "UnionEyes uses Supabase" architecture claims.

After: **0** across every category. `pci-compliance-service.ts` was converted to Drizzle/raw-SQL (its underlying `pci_dss_*` tables remain correctly `CONTAINED_NO_AUTHORITY` — zero production importers, unchanged). `db-adapter.ts` was deleted. A new ratchet test (`scripts/rls-enforcement/__tests__/supabase-purge-ratchet.test.ts`) fails CI on any regression, with an explicit, individually-reviewed allowlist for 8 remaining accurate historical/comparative references (see the JSON report for the full list).

## The "111" declarations — resolved as 95, fully dispositioned

A deterministic re-scan (`scripts/rls-enforcement/census-111-declarations.ts`) found **95** (not 111 — the earlier count came from a buggier ad-hoc regex) physical relation names declared only under `services/financial-service/**`, with **zero** duplicates against the canonical `db/schema/**` tree. Cross-referencing against the introspected `0000_lucky_mole_man.sql` snapshot: 84 are real physical relations at snapshot time; 11 were never migrated anywhere. All 19 `v_*`-prefixed names are confirmed ordinary base tables (not SQL views).

**Disposition: all 95 added to `db/rls-storage-authority/financial-service-latent.ts` as `LATENT_UNREACHABLE`, zero privileges, `scopeDisposition: DECLARATION_STALE_OR_NONCANONICAL`.** Manifest total: 700 → 795. **`UNKNOWN = 0`.**

## Finance DB principal decision

**No dedicated finance-specific roles created.** Every financial-service-owned relation is currently zero-privilege (`LATENT_UNREACHABLE`) — there is no current privilege-separation problem to solve. Must be revisited if/when financial-service is actually deployed.

## arbitration_decisions defect — fixed

`writeRole` changed from the ordinary per-tenant `steward` (level 50) to the genuinely platform-elevated `content_manager` (level 208) across all 5 routes, closing the global-write defect this round (previously only "carried forward" in Round 58C). Regression test: `app/api/arbitration/precedents/__tests__/arbitration-decisions-writerole.test.ts` (5/5 passing).

## Blanket grant removal

All gating conditions (Supabase = 0, `UNKNOWN` = 0, geometry blockers = 0, `TBD` = 0, arbitration defect closed) are satisfied. The generator's own `blanketGrantRemovalGateOk` check (recomputed fresh on every regeneration — a future un-classified table automatically re-widens back to the safe state) evaluated **true**. PART E now revokes 0108's blanket table/sequence grants; schema `USAGE` and database `CONNECT` are retained.
