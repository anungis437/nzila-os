# Phase 0B.2R §3 — Ownership Manifest Audit (111 → 125 Delta)

**Status:** REVIEW COMPLETE — findings recorded.
**Corrective phase:** Phase 0B.2R (branch `fix/union-eyes-phase0b-clean`).
**Source manifest:** [packages/db/schema-ownership-manifest.json](../../../../packages/db/schema-ownership-manifest.json) (125 tables, 0 `OWNERSHIP_UNRESOLVED`).
**Companion (generated):** [phase-0b2/phase-0b2-ownership-manifest.md](../phase-0b2/phase-0b2-ownership-manifest.md) (42 KB).
**Generator:** [scripts/audit/build-phase0b2-ownership-manifest.py](../../../../scripts/audit/build-phase0b2-ownership-manifest.py) (507 lines).
**Validator (re-run from clean checkout):** `pnpm tsx tooling/checks/schema-ownership-validate.ts` → **EXIT 0** (recorded 2026-07-24, this worktree).

## 0. Reason this document exists

The Phase 0B.2 closure treated the generator's output as its own evidence. Per the Phase 0B.2R
mandate:

> "Do not treat generator output as independent review evidence."

This document therefore:

1. Explains the arithmetic that produces 125 rows from the 111-collision inventory.
2. Reviews the 14 **manually-added** cross-boundary / foundational entries against the required
   6-field provenance (migration source · Django model/migration · runtime reader · runtime writer
   · business meaning · DDL ownership rationale).
3. Records — honestly — that the 96 `UNION_EYES_OWNED_EXCLUSIVE` rows and the 9 `DJANGO_INTERNAL`
   rows were **auto-classified** by the builder from the collision inventory + Django framework
   allow-list and were **not** individually reviewed in Phase 0B.2; they carry the boilerplate
   rationale text from the classifier.

## 1. 111 → 125 delta arithmetic

| Bucket | Source | Count |
| --- | --- | ---: |
| Collision inventory | `reports/audits/.../phase-0b1/phase-0b-table-collision-inventory.json` (`total_collisions`, `inventory.length`) | **111** |
| Manually-added extras | `EXTRA_MANIFEST_ENTRIES` in [build-phase0b2-ownership-manifest.py](../../../../scripts/audit/build-phase0b2-ownership-manifest.py) (lines 132–247) | **14** |
| **Total** | — | **125** |

Verified: none of the 14 extras appears in the collision inventory (no double-count).

Command used to confirm (PowerShell, clean worktree):

```powershell
$inv = Get-Content 'reports/audits/cupe-national-phase-0/phase-0b1/phase-0b-table-collision-inventory.json' -Raw | ConvertFrom-Json
$inv.total_collisions            # → 111
$inv.inventory.Count             # → 111
@('audit_events','pilot_definitions','pilot_metric_events','pilot_metric_rollups',
  'pilot_alerts','pilot_alert_rules','pilot_alert_escalations','pilot_health_scores',
  'ue_case_risk_snapshots','ue_cognition_audits','ue_engagement_snapshots','ue_kpi_snapshots',
  'ue_precedent_matches','ue_workload_snapshots') |
  ForEach-Object { $t = $_; if ($inv.inventory | Where-Object { $_.table -eq $t }) { "$t IN inv" } else { "$t NOT in inv" } }
```

All 14 → `NOT in inv`. Confirmed for `orgs`, `organizations`, `organization_members`,
`stripe_webhook_events`: **IN** inventory (collision entries reclassified, not added).

## 2. Required audit table (per Phase 0B.2R mandate)

| Column | Value / Note |
| --- | --- |
| Original collision names (source) | 111 rows in `phase-0b-table-collision-inventory.json`. Includes `orgs`, `organizations`, `organization_members`, `stripe_webhook_events`, `documents`, `votes`, plus 9 Django-framework tables and 96 pure UE tables. |
| Additional manifest tables (delta) | 14 rows added by `EXTRA_MANIFEST_ENTRIES`. Reason: they are foundational-slice targets (pilot metrics, audit_events, ue_* cognition) that are **not** collision cases — Platform Drizzle or Django alone defines them today, so the collision-only inventory could not surface them. |
| Reason each extra was added | See §3 provenance table below (per-row). |
| Final unique qualified | 125 rows, each with (`table`, `ownership`, `ddl_owner`, `target_schema`, `foundational`, `rationale`). `ownership ∈ {DJANGO_INTERNAL, PLATFORM_OWNED_EXCLUSIVE, PLATFORM_OWNED_SHARED, SAME_NAME_DIFFERENT_MEANING, UNION_EYES_OWNED_EXCLUSIVE, UNION_EYES_OWNED_SHARED}`. |
| Final unresolved | **0** `OWNERSHIP_UNRESOLVED`. Validator asserts this (`assertNoUnresolved`), so a nonzero would fail CI. |
| Generated automatically | 111 collision rows classified by [classify()](../../../../scripts/audit/build-phase0b2-ownership-manifest.py) heuristics (`DJANGO_INTERNAL` allow-list, `SAME_NAME_DIFFERENT_MEANING` allow-list, `PLATFORM_OWNED_SHARED_EXPLICIT` allow-list, then fall-through to `UNION_EYES_OWNED_EXCLUSIVE` or `PLATFORM_OWNED_EXCLUSIVE_HINT`). All 96 `UNION_EYES_OWNED_EXCLUSIVE` and all 9 `DJANGO_INTERNAL` rows fall in this bucket. Their rationale is the classifier's boilerplate string. |
| Manually reviewed (this document) | 14 extras + 4 collision-reclassified cross-boundary rows (`orgs`, `organizations`, `organization_members`, `stripe_webhook_events`) + 2 `SAME_NAME_DIFFERENT_MEANING` (`documents`, `votes`) = **20 rows** with per-row provenance in §3. |

**Honest scope statement.** The 96 `UNION_EYES_OWNED_EXCLUSIVE` rows and the 9 Django framework
rows were **not individually reviewed** in Phase 0B.2 and are not individually reviewed here.
They inherit the classifier's assertion — "UE Django migration defines it, platform does not
reference it" — which the collision inventory supports at the aggregate level. Phase 0B.2R does
not upgrade these to individual proof; that would require every one of the 96 tables to have
verified Django migration source + verified absence-of-platform-reference + verified runtime
call-site, which is Phase 0C / Phase 1 scope for non-foundational tables.

## 3. Per-decision provenance (20 manually-reviewed rows)

Each row records: **Migration source** · **Django model / migration** · **Runtime reader** ·
**Runtime writer** · **Business meaning** · **DDL ownership rationale**.

### 3.1 Foundational cross-schema contract

#### `public.orgs` — `PLATFORM_OWNED_SHARED`, foundational ✅

- **Migration source (Drizzle):** [packages/db/src/schema/orgs.ts](../../../../packages/db/src/schema/orgs.ts) line 46 (`export const orgs = pgTable('orgs', {...})`).
- **Django model / migration:** none; Django references only via `union_eyes.organizations.platform_tenant_id → public.orgs(id)` cross-schema FK created by adoption migration.
- **Runtime reader (production):** platform packages (`packages/db/src/schema/orgs.ts` re-exports); resolver read path `packages/platform-org-resolver/src/adapters/database.ts` (`resolveByAppOrganizationId` — JOIN `union_eyes.organizations ue JOIN public.orgs po`).
- **Runtime writer (production):** platform seed migration; provisioning path via `provisionPlatformParticipant()` in `apps/union-eyes/lib/organizations/platform-tenant.ts` (currently **has 0 production call-sites** — see [phase-0b2r-gap-analysis.md](phase-0b2r-gap-analysis.md)).
- **Business meaning:** canonical platform tenant identity. Every UE org must map 1:1.
- **DDL ownership rationale:** Platform owns `public.orgs` per Option D architecture approval; UE must FK across schemas.

#### `union_eyes.organizations` — `UNION_EYES_OWNED_SHARED`, foundational ✅

- **Migration source (Django):** [apps/union-eyes/backend/auth_core/models.py](../../../../apps/union-eyes/backend/auth_core/models.py) line 43 (`class Organizations(BaseModel)`), `db_table = "organizations"` line 217 → moved into `union_eyes` schema by adoption migration `apps/union-eyes/backend/*/migrations/0037_move_organizations_to_union_eyes.py` (per Phase 0B.2 evidence, §7 in [phase-0b2-foundational-slice.md](../phase-0b2/phase-0b2-foundational-slice.md)).
- **Platform Drizzle:** no CREATE TABLE. Cross-schema read only.
- **Runtime reader (production):** UE Django ORM (many `models.ForeignKey('Organizations', ...)` across UE apps). Resolver DB adapter reads via `union_eyes.organizations`.
- **Runtime writer (production):** UE Django admin, UE onboarding flow. **Zero calls to `provisionPlatformParticipant()` today** — new orgs created without contract enforcement (documented gap; addressed in §5).
- **Business meaning:** UE-side tenant row. `platform_tenant_id UUID FK → public.orgs(id)` + `CHECK (platform_tenant_id = id)` enforces identity.
- **DDL ownership rationale:** UE creates the row (its Django ORM depends on it structurally); platform enforces the cross-schema contract.

#### `public.organization_members` — `PLATFORM_OWNED_SHARED`, foundational ✅ — **AUDIT FINDING**

- **Migration source (Drizzle):** **NOT PRESENT** in `packages/db/**` today. No `pgTable('organization_members', ...)`. Grep against `packages/db/src/schema/**` returns 0 matches.
- **Django model / migration:** [apps/union-eyes/backend/auth_core/models.py](../../../../apps/union-eyes/backend/auth_core/models.py) line 726 (`class OrganizationMembers(BaseModel)`), line 754 `db_table = 'public"."organization_members'` — cross-schema reference with Django adopts-via-`managed=False` intent (comment cites "Phase 0B.2 §9").
- **Runtime reader:** UE Django ORM (`auth_core.OrganizationMembers`), platform packages that consume org membership (searched by table name — no direct Drizzle reader in `packages/db`).
- **Runtime writer:** UE Django ORM.
- **Business meaning:** essential membership rows (who belongs to which org).
- **DDL ownership rationale (manifest):** "platform" — **but the platform DDL does not exist yet**. The classification records the **target** state per Option D; the Drizzle side of the SHARED contract is aspirational until platform emits its own `CREATE TABLE`. Manifest `platform_sources` field is empty (accurately reflects this).
- **Finding:** the SHARED classification for `organization_members` is aspirational, not enforced. Phase 0B.2R does not create the Drizzle side (out of scope per "do not introduce a new architecture"), but this asymmetry must be recorded honestly for audit.

#### `public.audit_events` — `PLATFORM_OWNED_SHARED`, foundational ✅ — **AUDIT FINDING**

- **Migration source (Drizzle):** [packages/db/src/schema/operations.ts](../../../../packages/db/src/schema/operations.ts) line 177 (`export const auditEvents = pgTable('audit_events', ...)`) — Drizzle DDL exists.
- **Django model / migration:** **NONE**. Grep for `db_table = 'audit_events'` and `db_table = "audit_events"` across `apps/union-eyes/backend/**/models.py` returns 0. Grep against `apps/union-eyes/backend/**/migrations/**` returns 0.
- **Runtime reader:** Union Eyes audit-log queries via `apps/union-eyes/lib/audit-logger.ts` (writer, but also queried by administrative routes not audited here). Platform reads via Drizzle in various apps.
- **Runtime writer:** [apps/union-eyes/lib/audit-logger.ts](../../../../apps/union-eyes/lib/audit-logger.ts) `auditLog()` — INSERT via `withRLSContext` writing to `audit_events`. **This is a real UE→Platform write today**, but it does NOT resolve `platform_tenant_id` (uses UE org id directly). Addressed by §5.5 (`auditLogWithPlatformScope`).
- **Business meaning:** cross-service audit trail; platform-owned surface for regulatory retention.
- **DDL ownership rationale (manifest):** "platform" — Drizzle DDL exists. The "SHARED" qualifier means Django will read/write via `managed=False`, but **the Django-side adoption model does not exist yet**. Manifest `django_sources` empty (accurately reflects this).
- **Finding:** platform side is real; Django-managed-False adoption side is aspirational. UE writes today via raw SQL in `audit-logger.ts`, not via a Django model. This is an honest asymmetry.

#### `public.stripe_webhook_events` — `PLATFORM_OWNED_SHARED`, non-foundational

- **Migration source (Drizzle):** [packages/db/drizzle/0000_initial.sql](../../../../packages/db/drizzle/0000_initial.sql) line 674 (`CREATE TABLE "stripe_webhook_events" ...`), also referenced by [packages/db/src/schema/payments.ts](../../../../packages/db/src/schema/payments.ts).
- **Django model / migration:** [apps/union-eyes/backend/billing/models.py](../../../../apps/union-eyes/backend/billing/models.py) line 474 `db_table = 'stripe_webhook_events'` (with `managed = False` — verified adoption pattern).
- **Runtime reader:** billing dashboards (platform + UE billing views).
- **Runtime writer:** platform Stripe webhook handler.
- **Business meaning:** billing event log.
- **DDL ownership rationale:** SHARED-real (both sides exist and are wired). Not in foundational slice — not touched by Phase 0B.2.

### 3.2 `SAME_NAME_DIFFERENT_MEANING` (2 rows)

#### `documents`

- **Platform intent:** `public.documents` = evidence/operations documents ([packages/db/src/schema/operations.ts](../../../../packages/db/src/schema/operations.ts)).
- **UE intent:** `apps/union-eyes/backend/content/migrations/0001_initial.py` — UE app-side content table.
- **Resolution:** rename Django table to `union_eyes.content_documents` in a future wave. **Not merged. Not touched in 0B.2 or 0B.2R.**

#### `votes`

- **Platform intent:** `public.votes` = platform governance votes ([packages/db/src/schema/governance.ts](../../../../packages/db/src/schema/governance.ts)).
- **UE intent:** `apps/union-eyes/backend/unions/migrations/0001_initial.py` — Django union-membership votes.
- **Resolution:** rename Django table to `union_eyes.union_votes` in a future wave. Not touched.

### 3.3 Foundational pilot surfaces (3 rows) — all `PLATFORM_OWNED_EXCLUSIVE`, foundational ✅

#### `public.pilot_definitions`

- **Migration source (Drizzle):** [packages/db/drizzle/0009_pilot_metrics_layer.sql](../../../../packages/db/drizzle/0009_pilot_metrics_layer.sql) line 1 (`CREATE TABLE IF NOT EXISTS pilot_definitions`), FK'd by 0010/0033/0037.
- **Schema binding:** [packages/db/src/schema/pilot-metrics.ts](../../../../packages/db/src/schema/pilot-metrics.ts) line 17 (`'pilot_definitions'`).
- **Django:** none.
- **Runtime reader (production):** [apps/union-eyes/app/api/pilot/metrics/route.ts](../../../../apps/union-eyes/app/api/pilot/metrics/route.ts) → [apps/union-eyes/lib/services/pilot-metrics.ts](../../../../apps/union-eyes/lib/services/pilot-metrics.ts) via `db.execute(sql\`...\`)`. **Currently uses `organizationId` directly, does NOT resolve platform tenant id.** Target of §5 Path 2.
- **Runtime writer:** platform-side pilot admin flows (not in UE scope).
- **Business meaning:** definitions of Union Eyes pilots (pilot_id → org, dimensions).
- **DDL ownership rationale:** platform-only origination; UE consumes via governed resolver (target state).

#### `public.pilot_metric_events`

- **Migration source (Drizzle):** [packages/db/drizzle/0009_pilot_metrics_layer.sql](../../../../packages/db/drizzle/0009_pilot_metrics_layer.sql) (same file).
- **Django:** none.
- **Runtime reader/writer:** UE `pilot-events` route ([apps/union-eyes/app/api/pilot/events/route.ts](../../../../apps/union-eyes/app/api/pilot/events/route.ts)) writes to related table `pilot_events` — note UE writes to its own `pilot_events` table (declared in [apps/union-eyes/db/schema/domains/pilot/pilot-events.ts](../../../../apps/union-eyes/db/schema/domains/pilot/pilot-events.ts)), NOT to platform's `pilot_metric_events`. Cross-side integration is via aggregation, not direct write. Target of §5 Path 1 wrapping.
- **Business meaning:** platform telemetry stream per pilot.
- **DDL ownership rationale:** platform-only, aggregated from UE via ETL/rollups (future path).

#### `public.pilot_metric_rollups`

- **Migration source (Drizzle):** [packages/db/drizzle/0009_pilot_metrics_layer.sql](../../../../packages/db/drizzle/0009_pilot_metrics_layer.sql).
- **Django:** none.
- **Runtime reader:** platform admin only today; UE has no direct reader wired.
- **Runtime writer:** platform rollup jobs.
- **Business meaning:** rolled-up pilot metrics.
- **DDL ownership rationale:** platform-only.

### 3.4 Non-foundational pilot surfaces (4 rows) — all `PLATFORM_OWNED_EXCLUSIVE`, foundational ❌

`pilot_alerts`, `pilot_alert_rules`, `pilot_alert_escalations`, `pilot_health_scores`.

- **Migration source (Drizzle):** `packages/db/drizzle/0010_pilot_alerting_hardening.sql`, `0033_fix_pilot_alerts_rule_fk.sql`, `0037_heal_pilot_alerting_hardening.sql`.
- **Django:** none.
- **Runtime reader/writer:** platform alerting; no UE routes.
- **Business meaning:** pilot alerting infrastructure.
- **DDL ownership rationale:** platform-only, non-foundational — declared for completeness so `ownership` is unambiguous, but no Phase 0B.2 schema change.

### 3.5 UE Cognition foundational (6 rows) — all `UNION_EYES_OWNED_EXCLUSIVE`, foundational ✅

`ue_case_risk_snapshots`, `ue_cognition_audits`, `ue_engagement_snapshots`, `ue_kpi_snapshots`, `ue_precedent_matches`, `ue_workload_snapshots`.

- **Migration source (Drizzle):** UE `db/schema/domains/cognition/*.ts` — declared under `union_eyes` schema by Phase 0B.2 §12 promotion migration.
- **Django:** none (UE Drizzle-only tables).
- **Runtime reader/writer:** [packages/sage-core](../../../../packages/sage-core) computes KPIs and writes snapshots; read by [apps/union-eyes/app/api/cognition/kpis/route.ts](../../../../apps/union-eyes/app/api/cognition/kpis/route.ts) → `computeKpiSnapshot({ subject: { tenantId: 'union-eyes', orgId: context.organizationId } })`. **Currently passes UE `context.organizationId` directly as `orgId`, does NOT scope by platform tenant id.** Target of §5 Path 3.
- **Business meaning:** UE Cognition-layer telemetry snapshots.
- **DDL ownership rationale:** UE-only, but foundational because Phase 0B.2 §12 promoted their IDs to `TEXT` prefixed and moved them into `union_eyes` schema.
- **KPI DB migration proof:** deferred to §7.

## 4. Mass-classified buckets (auto, not individually reviewed)

### 4.1 `UNION_EYES_OWNED_EXCLUSIVE` (96 rows) — auto-classified

Rationale used by classifier (identical text on all 96 rows):

> "Table exists only in the Union Eyes Django migrations. Platform Drizzle does not define or
> reference it. DDL owner = Union Eyes; target schema = union_eyes (moved out of public in
> Phase 0B.2 §8 for the foundational slice; non-foundational tables move in a later wave)."

**Basis:** collision inventory records these tables as appearing only in the Django lineage
(`platform_files: []`, `django_files: [<migration>]`). Classifier fall-through: no allow-list
match → `UNION_EYES_OWNED_EXCLUSIVE`. Not individually reviewed for runtime reader/writer.

### 4.2 `DJANGO_INTERNAL` (9 rows) — auto-classified

Django framework tables: `auth_group`, `auth_group_permissions`, `auth_permission`, `auth_user`,
`auth_user_groups`, `auth_user_user_permissions`, `django_admin_log`, `django_content_type`,
`django_migrations`. Owner = Django framework; MUST NOT be recreated by platform. Not
individually reviewed beyond framework provenance.

## 5. Manifest weakness noted

For the 14 `EXTRA_MANIFEST_ENTRIES`, the generator does NOT populate `platform_sources` /
`django_sources` fields (they are derived from the collision inventory, which the extras bypass).
The evidence for those rows lives in the Python source rationale, not the JSON. This is an audit
weakness — external consumers of the JSON cannot trace those tables to source files without
reading the builder script.

**Not fixed in Phase 0B.2R** (would require rewriting the generator + regenerating the manifest;
scope creep beyond the corrective mandate). Filed as future-work note.

## 6. Validator re-run (clean checkout)

```powershell
cd C:\APPS\nzila-automation-phase0b-clean
pnpm tsx tooling/checks/schema-ownership-validate.ts
```

Output (captured 2026-07-24):

```
Schema ownership manifest is valid.
  Tables declared:            125
  Foundational slice size:    13
  OWNERSHIP_UNRESOLVED count: 0
  Ownership distribution:
    DJANGO_INTERNAL                    9
    PLATFORM_OWNED_EXCLUSIVE          13
    PLATFORM_OWNED_SHARED              4
    SAME_NAME_DIFFERENT_MEANING        2
    UNION_EYES_OWNED_EXCLUSIVE        96
    UNION_EYES_OWNED_SHARED            1
```

Exit code: `0`.

## 7. Conclusions

1. **Delta arithmetic is defensible:** 111 collisions + 14 manually added = 125. No double-count.
2. **Foundational slice (13 tables) is reviewed** with per-row provenance. 2 asymmetries flagged
   (`organization_members` platform DDL absent; `audit_events` Django adoption absent) and
   recorded honestly.
3. **96 UE_OWNED_EXCLUSIVE + 9 DJANGO_INTERNAL rows are auto-classified boilerplate** — not
   individually reviewed. Phase 0B.2R records this fact rather than upgrading it.
4. **Validator PASSES from a clean checkout** with `OWNERSHIP_UNRESOLVED = 0`.
5. **Manifest generator has a JSON-side weakness** for the 14 extras (empty
   `platform_sources`/`django_sources`); rationale text is present but not machine-traceable.

This section closes Phase 0B.2R §3.
