# Phase 0B.2 — Foundational Slice Detail

**Phase:** 0B.2 (governed hybrid execution)
**Architecture decision:** Option D — Governed hybrid ([approval](./phase-0b2-architecture-approval.md))
**Canonical manifest:** [`packages/db/schema-ownership-manifest.json`](../../../../packages/db/schema-ownership-manifest.json)
**Companion:** [`phase-0b2-ownership-manifest.md`](./phase-0b2-ownership-manifest.md)
**Validator:** [`tooling/checks/schema-ownership-validate.ts`](../../../../tooling/checks/schema-ownership-validate.ts)

---

## 1. Purpose

Phase 0B.2 does **not** migrate the entire 111-table collision surface. It executes a
minimal, high-value **foundational slice** that:

- Establishes the cross-schema organization contract (`union_eyes.organizations.platform_tenant_id → public.orgs(id)`).
- Adopts governed schema separation for the Union Eyes tables that participate in the pilot cadence (`pilot_definitions` / `pilot_metric_events` / `pilot_metric_rollups`, plus the six UE Cognition telemetry tables).
- Materialises **foundational rows only** for the two shared audit surfaces (`audit_events`, `organization_members`) — no full-table DDL migration for shared surfaces in this phase.

Every other table declared in the ownership manifest keeps its **current** DDL owner and
schema until a later wave. The manifest still records the intended target state so that
downstream waves inherit a single source of truth.

---

## 2. Foundational tables (13)

| # | Table | Ownership | DDL owner | Target schema | Why this table is foundational | Migration in Phase 0B.2 |
| :-: | --- | --- | --- | --- | --- | --- |
| 1 | `orgs` | `PLATFORM_OWNED_SHARED` | platform | `public` | Canonical platform tenant identity. Every other cross-cutting surface (audit, resolver, RLS context) needs a stable identifier here. | No DDL change (already exists in Drizzle). Manifest declares platform as the sole DDL owner; Django adopts via `managed = False`. |
| 2 | `organizations` | `UNION_EYES_OWNED_SHARED` | union_eyes | `union_eyes` | Tenant row on the Django side of the contract. Holds the `platform_tenant_id` FK back to `public.orgs(id)`. | §8 relocates from `public.organizations` → `union_eyes.organizations`; §10 adds the cross-schema FK + `CHECK (platform_tenant_id = id)` + unique index. |
| 3 | `organization_members` | `PLATFORM_OWNED_SHARED` | platform | `public` | Essential membership needed for platform identity resolution in the resolver, audit writes, and RLS. Django adopts via `managed = False`. | Foundational rows only. Full DDL migration of the shared surface is deferred to a later wave; §11 wires the resolver to read `public.organization_members`. |
| 4 | `audit_events` | `PLATFORM_OWNED_SHARED` | platform | `public` | Shared audit surface for platform-side identity events. Union Eyes writes through the governed resolver only. | Foundational rows only. §11 confirms the write path goes through the resolver — no full-table DDL migration in this phase. |
| 5 | `pilot_definitions` | `PLATFORM_OWNED_EXCLUSIVE` | platform | `public` | Pilot cadence anchor referenced by the resolver and the KPI stream. | No DDL change (Drizzle already owns it). |
| 6 | `pilot_metric_events` | `PLATFORM_OWNED_EXCLUSIVE` | platform | `public` | Raw pilot metric stream consumed by the KPI rollup path. | No DDL change (Drizzle already owns it). |
| 7 | `pilot_metric_rollups` | `PLATFORM_OWNED_EXCLUSIVE` | platform | `public` | Aggregated pilot metric surface read by the platform pilot dashboards. | No DDL change (Drizzle already owns it). |
| 8 | `ue_case_risk_snapshots` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition telemetry — must exist in the `union_eyes` schema so the platform never inadvertently DDLs it in `public`. | §8 creates in `union_eyes`; §12 promotes `id` from `uuid gen_random_uuid()` to `text PRIMARY KEY` preserving prefixed IDs. |
| 9 | `ue_cognition_audits` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition audit trail. | §8 create + §12 text-ID promotion. |
| 10 | `ue_engagement_snapshots` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition engagement telemetry consumed by KPI rollup. | §8 create + §12 text-ID promotion. |
| 11 | `ue_kpi_snapshots` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition KPI snapshot surface referenced by §11 resolver integration. | §8 create + §12 text-ID promotion. |
| 12 | `ue_precedent_matches` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition precedent-match telemetry. | §8 create + §12 text-ID promotion. |
| 13 | `ue_workload_snapshots` | `UNION_EYES_OWNED_EXCLUSIVE` | union_eyes | `union_eyes` | UE Cognition workload telemetry. | §8 create + §12 text-ID promotion. |

**Total foundational tables:** 13
**Cross-schema FK edges introduced:** 1 (`union_eyes.organizations.platform_tenant_id → public.orgs.id`)

---

## 3. Dependency ordering

Ordered so that every step's prerequisites are already in place.

1. **`public.orgs` exists** — precondition (already true in the Drizzle baseline).
2. **`public.pilot_definitions`, `public.pilot_metric_events`, `public.pilot_metric_rollups` exist** — precondition (already true in the Drizzle baseline).
3. **`public.audit_events`, `public.organization_members` exist** — precondition rows only; DDL unchanged.
4. **`CREATE SCHEMA IF NOT EXISTS union_eyes`** — first op of the earliest Union-Eyes-owned migration on the Django side (§7 strategy, §8 migration).
5. **Create UE-owned foundational tables in `union_eyes`** (§8):
   `union_eyes.organizations`, `union_eyes.ue_case_risk_snapshots`, `union_eyes.ue_cognition_audits`, `union_eyes.ue_engagement_snapshots`, `union_eyes.ue_kpi_snapshots`, `union_eyes.ue_precedent_matches`, `union_eyes.ue_workload_snapshots`.
6. **Cross-schema organization contract migration (Drizzle, §10)** — supersedes migration 0038 on the clean branch:
   - Add column `union_eyes.organizations.platform_tenant_id uuid NOT NULL`.
   - Foreign key `union_eyes.organizations.platform_tenant_id → public.orgs(id)`.
   - `CHECK (platform_tenant_id = id)` enforcing 1:1 identity.
   - Unique index on `(platform_tenant_id)` guaranteeing single mapping.
7. **Resolver wiring (§11)** — governed provisioning + explicit resolver in foundational paths (pilot definitions, pilot metrics, KPI org ownership, RLS context, audit writes). No read-time provisioning.
8. **UE Cognition text-ID promotion (§12, migration 0039)** — promote `id uuid gen_random_uuid()` → `text PRIMARY KEY` on the six UE Cognition tables, preserving existing prefixed identifiers, rebuilding indexes/FKs, second-run idempotent.

---

## 4. Non-foundational tables — deferred to later waves

The other 112 tables declared in the manifest are **not** migrated in Phase 0B.2. Their
declared ownership state is authoritative for future waves but no DDL change is executed
in this phase.

| Ownership class | Non-foundational count | Deferred to |
| --- | ---: | --- |
| `PLATFORM_OWNED_EXCLUSIVE` (non-foundational) | 10 | Future platform hardening waves (commerce, evidence_packs, pilot_* alerting). |
| `PLATFORM_OWNED_SHARED` (non-foundational) | 1 | Future wave (Stripe webhook events adoption). |
| `UNION_EYES_OWNED_EXCLUSIVE` (non-foundational) | 90 | Future Union Eyes schema-move wave — all tables move `public.<name>` → `union_eyes.<name>` under `db_table = 'union_eyes.<name>'`. |
| `SAME_NAME_DIFFERENT_MEANING` | 2 | Future rename wave (`documents`, `votes`). |
| `DJANGO_INTERNAL` | 9 | Handled by governed schema strategy (§7); framework internals never enter `public`. |

**Non-foundational total:** 112

---

## 5. Runtime dependencies

| Surface | Depends on foundational table | Wired in |
| --- | --- | --- |
| Organization resolver | `public.orgs`, `union_eyes.organizations`, `public.organization_members` | §11 |
| Pilot cadence metrics | `public.pilot_definitions`, `public.pilot_metric_events`, `public.pilot_metric_rollups` | §11 |
| KPI stream / RLS context | `public.orgs`, `union_eyes.organizations`, UE Cognition telemetry tables | §11 |
| Audit write path | `public.audit_events` (via resolver, never direct writes from Union Eyes) | §11 |
| UE Cognition text-ID API | Six UE Cognition telemetry tables in `union_eyes` schema | §12 |

---

## 6. Tests required per foundational table

Detailed test list is authored under §16 (Tests). The minimum expectations are:

- Manifest validator (`tooling/checks/schema-ownership-validate.ts`) — PASS with 0 errors.
- Organization contract migration — negative test: inserting `union_eyes.organizations` row with a `platform_tenant_id` that does not exist in `public.orgs` MUST fail; positive test: 1:1 mapping succeeds.
- Resolver — foundational-path integration tests must fail closed when the organization mapping is missing (no read-time provisioning).
- UE Cognition text-ID migration — positive test: existing prefixed IDs preserved; negative test: attempting to insert a NULL or non-text `id` fails; idempotency test: applying migration 0039 twice is a no-op.

---

## 7. Non-goals (re-stated for continuity with the architecture approval)

- No 111-table sweep. Only the 13 foundational tables migrate in Phase 0B.2.
- No historical rewrite of `fix/union-eyes-reality-remediation` — that branch remains an evidence branch.
- No cherry-pick of `1e5a6bd94` / `7a1c90ab3`. Focused reconstruction only (§13).
- No 255-file test sweep. Only tests directly supporting the foundational slice.
- No Phase 0C / 0D / Phase 1 work. No deployment. No CUPE scenario graduation.
