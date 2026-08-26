# Organization Provisioning Proof — Phase 0B

**Status.** AMBER — 9 mappings established on the dev DB, backed by DB constraints there; the same set of mappings is NOT provable on a governed clean DB because the two schema lineages (platform + Django) currently collide on 111 tables (see `organization-model-verification.md` § 5–6). The marker table `drizzle.__phase0b_outcomes` correctly records the dev-DB state as `outcome_class = applied` and the clean-DB state as `deferred-app-schema-absent`.

**Date.** 2026-04-24 baseline, amended 2026-04-25 (this document) — supersedes the 2026-04-24 GREEN classification.

**Prior classification (superseded).** The prior revision declared `Status: GREEN — 9 mappings established, backed by DB constraints, replayable on clean DB` and cited `phase-0b-clean-db-proof.log` (which records `outcome_class = full-success` — the false-success signal) as the clean-DB replay proof. The 9 mappings on the dev DB are still correct and are retained below. The clean-DB replay claim was defective and is corrected in § 6.

**Scope.** Row-level evidence that migration `0038_phase_0b_organization_and_kpi_integrity.sql` establishes the full set of same-UUID `organizations ↔ orgs` pairings required by Phase 0B on any environment where both lineages are materialized, including the 4 synthetic QA orgs previously missing. On the dev DB the provisioning is complete; on a governed clean DB the provisioning is deferred and honestly recorded as such by the new marker table.

**Anchor documents.**
- Decision (Outcome C, verbatim contract): `organization-model-decision.md`
- Dependency map: `organization-model-dependency-map.md`
- Constraint / lineage evidence: `organization-model-verification.md`
- Remaining work: `phase-0b-remaining-work-register.md`

---

## 1. Baseline (pre-migration 0038)

Before Phase 0B, `orgs` contained 6 rows and `organizations` contained 49 rows. Five of the 6 `orgs` rows had a same-UUID counterpart in `organizations` (informal convention, unenforced). The four synthetic QA organizations required for Union Eyes E2E, QA, external-tester, and guardrail workflows existed only in `organizations` — with no corresponding `orgs` row — so any platform-domain write (audit event, pilot metric, AI budget) against those UUIDs failed with a foreign-key violation. See `organization-model-dependency-map.md` § 2 for the pre-Phase-0B state.

---

## 2. Post-migration state (dev DB, 2026-04-24)

Verified against `nzila_automation` on `localhost:5433`:

| Metric | Value |
| --- | --- |
| `orgs` total | 10 |
| `organizations` total | 49 |
| `organizations.platform_tenant_id` populated | 9 |
| `organizations.platform_tenant_id` NULL | 40 |

The `orgs` table grew by 4 rows (from 6 to 10) — the four synthetic QA participants provisioned by operations (6)/(7) of migration 0038.

---

## 3. The 9 mappings

Enumerated via `SELECT ... FROM orgs INNER JOIN organizations ON organizations.id = orgs.id ORDER BY orgs.id;`:

| # | Shared UUID | `orgs.legal_name` | `organizations.name` | `organizations.organization_type` | Provenance |
| --- | --- | --- | --- | --- | --- |
| 1 | `11111111-1111-4111-8111-111111111111` | UE QA Primary Local | UE QA Primary Local | local | Phase 0B provisioning (synthetic QA) |
| 2 | `22222222-2222-4222-8222-222222222222` | UE QA Secondary Local | UE QA Secondary Local | local | Phase 0B provisioning (synthetic QA) |
| 3 | `33333333-3333-3333-3333-333333333333` | Afrobeats Records Inc. | Afrobeats Records | platform | Pre-existing shared-UUID pair (backfilled) |
| 4 | `33333333-3333-4333-8333-333333333333` | UE QA External Tester Sandbox | UE QA External Tester Sandbox | local | Phase 0B provisioning (synthetic QA) |
| 5 | `44444444-4444-4444-4444-444444444444` | MS Celebrations Entertainment Ltd. | MS Celebrations | platform | Pre-existing shared-UUID pair (backfilled) |
| 6 | `44444444-4444-4444-8444-444444444444` | UE Production Like Guardrail Org | UE Production Like Guardrail Org | local | Phase 0B provisioning (synthetic QA) |
| 7 | `458a56cb-251a-4c91-a0b5-81bb8ac39087` | Nzila Console Local Dev Org | NZILA Ventures | platform | Pre-existing shared-UUID pair (backfilled) |
| 8 | `9210418f-6a4f-4dab-a7d2-4450d581dc81` | TrustCore Admin Locked Org | CUPE Local 123 | local | Pre-existing shared-UUID pair (backfilled) |
| 9 | `a1b2c3d4-1111-4aaa-8aaa-000000000001` | Trustcore Demo Corp | Trustcore Demo Corp | union | Pre-existing shared-UUID pair (backfilled) |

**5 pre-existing pairs backfilled** (`platform_tenant_id` set to match `id`) by operation (5) of migration 0038.
**4 synthetic QA orgs newly provisioned** by operations (6) `INSERT ... ON CONFLICT DO NOTHING` and (7) `UPDATE ... WHERE platform_tenant_id IS NULL` of migration 0038.

---

## 4. Constraint enforcement

Every row above satisfies the two constraints established by migration 0038:

1. `organizations_platform_tenant_id_fk` — `platform_tenant_id` references an existing `orgs.id`. Since `platform_tenant_id = id` on all 9 rows, and `orgs.id` equals that value, the FK holds.
2. `organizations_platform_tenant_id_equals_id` — `CHECK ((platform_tenant_id IS NULL) OR (platform_tenant_id = id))`. Trivially satisfied by construction.

Any future attempt to write `platform_tenant_id` to a value that differs from `id`, or to a value that has no `orgs` row, will fail at the DB layer with a check/foreign-key violation.

---

## 5. Idempotency

Migration 0038 uses:

- `ADD COLUMN IF NOT EXISTS` for `platform_tenant_id`
- `information_schema.table_constraints` guard around `ADD CONSTRAINT ... FOREIGN KEY`
- `information_schema.table_constraints` guard around `ADD CONSTRAINT ... CHECK`
- `CREATE INDEX IF NOT EXISTS`
- `ON CONFLICT (id) DO NOTHING` for the 4 synthetic `orgs` INSERTs
- `WHERE platform_tenant_id IS NULL` guard on the two UPDATE statements

Verified via `phase-0b-dev-migrate-second-run.log`: second-run apply reports `39/39 already applied, exit 0`. No row was inserted twice; no constraint was created twice.

---

## 6. Clean-DB replay (corrected)

The prior revision claimed `nzila_phase0b_probe` proved clean-DB replay by recording `outcome_class = full-success` in `drizzle.__platform_migrations` on a DB where `public.organizations` was absent. That signal is not a substantive-outcome signal — it records only that the SQL file executed to completion, not whether the same-UUID contract was applied. Under the substantive-outcome marker table introduced this session (`drizzle.__phase0b_outcomes`), the correct clean-DB signal is `outcome_class = deferred-app-schema-absent`, and that is what the truly-clean probe DB `nzila_phase0b_probe_v4` records (evidence: `logs/phase-0b-clean-db-marker-probe-v4.log`).

A governed clean-DB replay of the substantive `applied` outcome — i.e. applying both lineages to the same fresh database so that 0038's substantive branch executes — was attempted this session in both orderings and both failed:

- Platform-first, Django-second: Django's `billing.0001_initial` failed with `relation "stripe_webhook_events" already exists` (SQLSTATE 42P07). Log: `logs/phase-0b-clean-db-django-migrate.log`.
- Django-first, platform-second: Platform's `0000_initial.sql` failed with `relation "votes" already exists`. Log: `logs/phase-0b-clean-db-django-first-platform-apply.log`.

The 111-table lineage overlap that causes both failures is a genuine governance defect and is enumerated in `phase-0b-remaining-work-register.md`.

**Consequence.** The 9 dev-DB mappings above are correct and constraint-enforced on the dev DB. Reproducing them on a governed clean DB requires prior deconfliction of the two lineages, which is out of Phase 0B scope.

---

## 7. Verdict

On the dev DB: all required same-UUID mappings are present, all required synthetic QA orgs exist, constraints prevent future divergence, and the migration is idempotent (verified via `phase-0b-dev-migrate-second-run.log`).

On a governed clean DB: provisioning is deferred and honestly recorded as `deferred-app-schema-absent`; upgrading to `applied` requires the lineage deconfliction registered in `phase-0b-remaining-work-register.md`.

**Organization provisioning: AMBER — CLOSED on dev, DEFERRED on governed clean DB.**
