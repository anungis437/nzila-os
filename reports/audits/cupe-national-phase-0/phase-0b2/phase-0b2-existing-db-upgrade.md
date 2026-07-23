# Phase 0B.2 — §15 Existing-DB Upgrade Proof

**Status.** ✅ PASS.
**Driver.** [`tooling/checks/phase0b2-upgrade.ps1`](../../../../tooling/checks/phase0b2-upgrade.ps1).
**Transcript.** [`logs/phase-0b2-upgrade-20260723095234.log`](logs/phase-0b2-upgrade-20260723095234.log).
**Precondition.** The disposable DB used here was already fully composed by
[`phase-0b2-clean-db-composition.md`](phase-0b2-clean-db-composition.md).
No fresh DB was cut for this test — that's the point: we are proving what
happens when 0038/0039 are re-applied to an already-migrated,
already-populated database.

## 1. What the driver does

1. **Seeds real-world tenant rows** into the composed DB:
   - `public.orgs` gets a row with id `11111111-1111-1111-1111-111111111111`,
     `legal_name='Acme Local 1'`, `jurisdiction='CA-QC'`, `status='active'`.
   - `union_eyes.organizations` gets the sibling row with the same UUID,
     `name='Acme Local 1'`, `slug='acme-local-1'`,
     `platform_tenant_id='11111111-1111-1111-1111-111111111111'`.
2. **Snapshots row counts BEFORE** re-applying migrations.
3. **Re-applies Drizzle 0038** (`packages/db/drizzle/0038_organization_cross_schema_contract.sql`).
4. **Re-applies Drizzle 0039** (`packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`).
5. **Snapshots row counts AFTER** and asserts contract compliance.
6. **Attempts a CHECK-constraint violation** to prove the DB still rejects
   any `platform_tenant_id ≠ id` assignment.

## 2. Observed transcript (verbatim from log)

```
===== STEP 1: Seed pre-existing rows =====
===== STEP 2: Snapshot BEFORE =====
 before.orgs.count=1
 before.ue_orgs.count=1
 before.ue_kpi_snapshots.count=0
===== STEP 3: Re-apply 0038 (expect no-op) =====
NOTICE:  column "platform_tenant_id" of relation "organizations" already exists, skipping
NOTICE:  relation "ux_organizations_platform_tenant_id" already exists, skipping
===== STEP 4: Re-apply 0039 (expect no-op) =====
===== STEP 5: Snapshot AFTER =====
 after.orgs.count=1
 after.ue_orgs.count=1
 after.ue_kpi_snapshots.count=0
 after.contract.check_ok=1
 after.contract.mismatch=0
===== STEP 6: Verify contract rejection =====
NOTICE:  contract.rejected=YES
```

## 3. Interpretation

| Property being tested | Result |
| --- | --- |
| Migration 0038 is idempotent on an already-migrated DB | ✅ `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and the DO-guarded `ADD CONSTRAINT` blocks emit only `NOTICE: already exists, skipping`. No error. |
| Migration 0039 is idempotent on an already-migrated DB | ✅ No output at all — every action guarded by `information_schema` checks fell through cleanly. |
| No row is dropped or duplicated by re-run | ✅ `before.orgs.count == after.orgs.count == 1`; `before.ue_orgs.count == after.ue_orgs.count == 1`. |
| The Option D same-uuid contract is preserved for seeded rows | ✅ `after.contract.check_ok=1`, `after.contract.mismatch=0`. |
| The DB still rejects a mis-set `platform_tenant_id` at UPDATE time | ✅ Explicit `UPDATE ... SET platform_tenant_id = <different uuid>` raised `check_violation` (caught + reported as `contract.rejected=YES`). |

## 4. What this proves and what it does NOT prove

### Proves

1. Re-running 0038 and 0039 against a populated database is **safe** —
   both migrations are truly idempotent and neither manipulates existing
   row data on the re-run path.
2. The Option D CHECK constraint remains armed after re-runs and will
   fault on any misassignment — not just at INSERT but also at UPDATE.
3. Row counts survive the re-run unchanged — no side-effect statements
   accidentally delete or duplicate anything.

### Does NOT prove

- Behavior when the target DB has rows that already **violate** the
  contract (e.g. UE org with a `platform_tenant_id` that doesn't match
  `id`). By §10 design, 0038 backfills via `UPDATE ... SET
  platform_tenant_id = id`, so any pre-existing mismatch is
  overwritten — but that side of the property is not exercised by this
  disposable DB. It is exercised by production-shape data during the
  Phase 0C rollout window.
- Backfill performance on multi-million-row tables (production-scale
  perf is a Phase 0C ops concern, not a Phase 0B contract concern).

## 5. Reproduction command

```powershell
# Prerequisite: phase0b2-compose.ps1 has already run against $env:PHASE0B2_DB.
$env:PGPASSWORD = 'nzila_dev'
pwsh -NoProfile -File tooling/checks/phase0b2-upgrade.ps1 `
    -DatabaseName $env:PHASE0B2_DB
```
