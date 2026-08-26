# Phase 0B — Organization Model Dependency Map

**Phase:** 0B · Organization and Identifier Integrity
**Author:** Copilot (executing per Aubert's authorized directive)
**Generated:** 2026-07-24
**Branch:** `fix/union-eyes-reality-remediation`
**HEAD:** `4d6f63511a1bde7f02408f5621a1ce9ca8a42245`
**Migration state at time of investigation:** dev DB at `0033` (0034–0037 pending until Phase 0B upgrade)

---

## 1. Two-model reality

There are TWO distinct organizational entity models in the platform database. They are architecturally separate — different column sets, different dependents, different generative sources — but a shared-UUID convention has emerged informally between platform-participating rows.

### 1.1 `public.orgs` — Platform tenant model

| Aspect | Value |
| --- | --- |
| Purpose | Corporation-level platform tenant identity (paying customer / system entity) |
| Row count (dev DB) | 6 |
| Primary key | `id uuid PK DEFAULT gen_random_uuid()` |
| Notable columns | `clerk_org_id varchar UNIQUE`, `legal_name text NN`, `jurisdiction varchar NN 'CA-ON'`, `incorporation_number`, `registered_office_address jsonb`, `fiscal_year_end varchar`, `policy_config jsonb`, `status org_status NN 'active'` |
| Provenance of rows | Historically provisioned during Clerk → Nzila auth migration and via seed scripts |
| Referenced by (sample) | `ai_*`, `audit_events`, `pilot_definitions`, `pilot_metric_events`, `pilot_alerts` (+ rules / escalations), `trustcore_*`, `itsm_*`, `zonga_*`, `commerce_*`, `ml_*`, `nacp_*`, `stripe_*`, `tax_*`, `close_*`, `executive_*`, `share_*`, `treasury_snapshots`, `qbo_*`, `ue_cases`, `votes` — roughly 130 tables |

**Current rows**

| id | legal_name |
| --- | --- |
| `00000000-0000-0000-0000-000000000000` | Nzila OS AI System |
| `33333333-3333-3333-3333-333333333333` | Afrobeats Records Inc. |
| `44444444-4444-4444-4444-444444444444` | MS Celebrations Entertainment Ltd. |
| `458a56cb-251a-4c91-a0b5-81bb8ac39087` | Nzila Console Local Dev Org |
| `9210418f-6a4f-4dab-a7d2-4450d581dc81` | TrustCore Admin Locked Org |
| `a1b2c3d4-1111-4aaa-8aaa-000000000001` | Trustcore Demo Corp |

### 1.2 `public.organizations` — Union hierarchy model

| Aspect | Value |
| --- | --- |
| Purpose | Canadian labour-union hierarchy (CLC-affiliated locals, districts, federations, congress) |
| Row count (dev DB) | 49 |
| Primary key | `id uuid PK` |
| Notable columns | `name text NN`, `slug text NN UNIQUE`, `organization_type organization_type_enum NN`, `parent_id uuid self-FK`, `hierarchy_path text[] NN`, `hierarchy_level int NN 0`, `province_territory`, `sectors labour_sector[]`, `clc_affiliated bool`, `charter_number`, `member_count int`, `active_member_count int`, `settings jsonb`, `features_enabled text[]`, `status text 'active'`, `clerk_organization_id text`, `legacy_tenant_id uuid` (unpopulated), `clc_affiliate_code`, `per_capita_rate numeric`, `remittance_day int`, `fiscal_year_end date`, `app_id FK applications` |
| Enum values for `organization_type` | `platform`, `union`, `federation`, `local`, `district`, `congress` |
| Referenced by (sample) | `grievance_*`, `arbitration_*`, `bargaining_units`, `organizing_*`, `message_*`, `notification_*`, `outreach_*`, `newsletter_*`, `ai_copilot_sessions`, `ai_budgets`, `kpi_configurations`, `org_configurations`, `member_*`, `employer_*` — roughly 200 tables |

**Current type breakdown**

| organization_type | rows | rows with matching `orgs` pair |
| --- | --- | --- |
| union | 15 | 1 |
| local | 15 | 1 |
| federation | 13 | 0 |
| platform | 3 | 3 |
| district | 2 | 0 |
| congress | 1 | 0 |

---

## 2. Cross-model reality (observed)

### 2.1 Shared-UUID convention (informal)

Five rows already share the same UUID between `orgs.id` and `organizations.id`:

| Shared UUID | orgs.legal_name | organizations.name | organizations.type |
| --- | --- | --- | --- |
| `33333333-3333-3333-3333-333333333333` | Afrobeats Records Inc. | Afrobeats Records | platform |
| `44444444-4444-4444-4444-444444444444` | MS Celebrations Entertainment Ltd. | MS Celebrations | platform |
| `458a56cb-251a-4c91-a0b5-81bb8ac39087` | Nzila Console Local Dev Org | NZILA Ventures | platform |
| `9210418f-6a4f-4dab-a7d2-4450d581dc81` | TrustCore Admin Locked Org | CUPE Local 123 | local |
| `a1b2c3d4-1111-4aaa-8aaa-000000000001` | Trustcore Demo Corp | Trustcore Demo Corp | union |

**Convention was unenforced pre-Phase 0B.** There was no FK, no mapping table, and no CHECK constraint. `organizations.legacy_tenant_id` was designed for this mapping (uuid-typed column) but is 0 % populated (0 / 49). Its `legacy_` prefix suggests it was intended for a Clerk-era migration and has since fallen dormant.

**Post-Phase 0B (migration 0038):** all five rows above are now formally captured via `organizations.platform_tenant_id`, backed by `organizations_platform_tenant_id_fk → orgs(id)` and the `organizations_platform_tenant_id_equals_id` CHECK constraint. See `organization-model-verification.md` for the constraint-level evidence.

### 2.2 Missing pairs — the four synthetic test orgs

| organizations.id | organizations.name | organization_type | orgs pair |
| --- | --- | --- | --- |
| `11111111-1111-4111-8111-111111111111` | UE QA Primary Local | local | ❌ MISSING |
| `22222222-2222-4222-8222-222222222222` | UE QA Secondary Local | local | ❌ MISSING |
| `33333333-3333-4333-8333-333333333333` | UE QA External Tester Sandbox | local | ❌ MISSING |
| `44444444-4444-4444-8444-444444444444` | UE Production Like Guardrail Org | local | ❌ MISSING |

These four rows are seeded for Union Eyes test workflows (E2E, QA, guardrail, external tester). None have an `orgs` row, so any platform-domain write (audit event, pilot metric, AI budget referencing `orgs`, etc.) for a user in one of these orgs fails with a foreign-key violation.

---

## 3. Authentication + authorization data flow (observed)

### 3.1 Auth-time org resolution

`apps/union-eyes/lib/organization-utils.ts::getOrganizationIdForUser(userId)` returns `public.organizations.id`, resolved in this priority order:

1. `selected_org_id` / `selected_organization_id` cookie value, if the caller has membership or platform-admin status.
2. Primary organization membership (`organization_members` table).
3. First available membership.
4. `DEFAULT_ORGANIZATION_ID = 458a56cb-251a-4c91-a0b5-81bb8ac39087` (fallback only permitted when `NODE_ENV !== 'production' && UE_ALLOW_DEFAULT_ORG === 'true'` — otherwise throws `OrgContextRequiredError`).

There is no call path that returns an `orgs.id` directly. Every UE app route receives an `organizations.id`.

Critical gotcha (recorded in user memory but restated here for the record): `auth().orgId` returns `entra.activeOrgId` which is an **Azure AD security-group GUID**, never an app-level organization UUID. Anywhere `auth().orgId` is currently used in query paths, the value can never satisfy an `organizations.id` or `orgs.id` filter.

### 3.2 Write-time cross-model FK collisions

The following FKs point to `orgs(id)` but are populated by app code using `organizations.id` values:

- `pilot_definitions.org_id → orgs(id)`
- `pilot_metric_events.org_id → orgs(id)` (with UNIQUE dedupe key `(org_id, pilot_id, metric_name, idempotency_key)`)
- `pilot_alerts.org_id → orgs(id)`
- `audit_events.org_id → orgs(id)`
- 100+ additional platform-domain tables (ai_*, itsm_*, trustcore_*, commerce_*, etc.)

**Consequence.** Today these writes only succeed for the four shared-UUID rows. For the other 45 organizations (including the four synthetic QA orgs and all federations / districts / unions without a matching `orgs` row), any platform-domain write silently fails at the DB layer with a `foreign_key_violation`.

---

## 4. KPI identifier defect

### 4.1 Runtime (file-backed, source of truth today)

- `packages/ue-cognition/src/kpis/engine.ts`, line 146: `id: makeId('kpi')`.
- `packages/ue-cognition/src/utils.ts`, line 18: `return \`\${prefix}_\${Date.now().toString(36)}_\${randomBytes(6).toString('hex')}\`` — produces `kpi_<base36>_<hex>` (non-UUID).
- `packages/ue-cognition/src/kpis/engine.ts`, line 203: `writeRecord(ENTITY, snapshot.id, snapshot, ueCognitionKpiSnapshotSchema)` — persists to `ops/ue-cognition/kpi-snapshots/<id>.json`.
- Live example: `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` (untracked, id `kpi_mrwhcp4b_d2f72515a580`, `subject.tenantId = "union-eyes"`, `subject.orgId = "11111111-1111-4111-8111-111111111111"`).

### 4.2 Declared DB schema (not yet materialized)

- `packages/ue-cognition/src/schema.ts` declares `ueKpiSnapshots.id = uuid('id').primaryKey()` and `orgId = uuid('org_id').notNull()` — plus similar UUID PK declarations for `ueCaseRiskSnapshots`, `ueWorkloadSnapshots`, `ueEngagementSnapshots`, `uePrecedentMatches`, `ueCognitionAudits`.
- File header comment: “NOT YET RUN AS A MIGRATION. Phase-1 storage is file-backed JSON under `ops/ue-cognition/`.”
- No `.sql` migration exists in `packages/db/drizzle/` that creates any of these tables (verified: `grep -l "ue_kpi" packages/db/drizzle/` returns zero results).

### 4.3 Defect classification

Two independent problems live together:

- **T1 (type mismatch).** The declared column type is `uuid`, but every value produced by the runtime engine is a non-UUID slug. If a future materialization migration is ever run, every insert fails with `invalid input syntax for type uuid: "kpi_..."`.
- **T2 (orgId ambiguity).** `ueKpiSnapshots.orgId` is declared `uuid NOT NULL` with **no FK**. The file-backed snapshots use `subject.orgId = "11111111-1111-4111-8111-111111111111"` — a value that today exists in `organizations` but not `orgs`. There is no schema signal telling a future implementer which model the FK should point to.

### 4.4 References not found

`ueKpiSnapshots` is not imported anywhere in the workspace (verified across `apps/**`, `packages/**`). It is a schema declaration awaiting implementation. The defect is therefore **latent**, not currently triggering runtime errors, but blocking any Phase-2 file→DB materialization until reconciled.

---

## 5. Seed / fixture references to the demo org UUID

Grep for `11111111-1111-4111-8111-111111111111` reveals references in:

- `ops/ue-cognition/kpi-snapshots/kpi_mrwhcp4b_d2f72515a580.json` (untracked runtime artifact).
- `apps/union-eyes/lib/organization-utils.ts` — no reference (uses `DEFAULT_ORGANIZATION_ID = 458a56cb...` instead).
- E2E / Playwright fixtures — deferred to Phase 0C investigation (Phase 0B is not authorized to touch Playwright).

The demo org UUID is a well-established constant in QA workflows. Repairing it into `orgs` is required to unblock ANY QA / dev / test path that writes to a platform-domain table under that identity.

---

## 6. Phase-ledger current state

- Phase 0A.1 is `GREEN — MIGRATION LINEAGE CLOSED` (three commits, 34-file empty-DB replay verified, --verify enforced).
- Phase 0 as a whole remains `AMBER — INCOMPLETE` — §4 (org-model), §5 (KPI id), §6 (Playwright), §7 (E2E), §10 (staging), §11 (smoke) still open.
- Phase 0B addresses §4 and §5 only. §§ 6–11 remain out of scope until user re-authorizes.

---

## 7. Row inventory summary

| Fact | Value |
| --- | --- |
| `orgs` rows | 6 |
| `organizations` rows | 49 |
| Rows with matching UUID in both tables | 4 |
| Synthetic QA orgs missing an `orgs` pair | 4 (1111, 2222, 3333-4333, 4444-8444) |
| `organizations.legacy_tenant_id` populated | 0 / 49 |
| Runtime `.json` KPI snapshots using non-UUID ids | 1 (may grow) |

---
