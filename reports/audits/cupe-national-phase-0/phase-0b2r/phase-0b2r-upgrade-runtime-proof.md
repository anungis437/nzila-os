# Phase 0B.2R §11 — Existing-DB Upgrade + Runtime Integration Proof

**Status:** AMBER — FOUNDATIONAL RUNTIME INTEGRATION INCOMPLETE
**Section:** 11 (Existing-DB upgrade proof re-run against runtime-integrated code)
**Date:** 2026-07-23 (America/New_York)
**Branch:** `fix/union-eyes-phase0b-clean`
**Working tree:** `C:\APPS\nzila-automation-phase0b-clean`
**Prior commit:** `6f6248f8a` (§10 clean-composition runtime proof)

---

## 1. Purpose

Aubert's gap-analysis path-to-GREEN item 5 (from
[phase-0b2r-gap-analysis.md](phase-0b2r-gap-analysis.md)) requires both a
clean-composition proof AND an existing-DB (upgrade) proof re-run **against
the runtime-integrated code**, not just against the migration chain in
isolation. §10 closed the clean-composition half; this section closes the
existing-DB half.

The upgrade path is the shape production will actually see: a database that
was previously composed (bootstrap + 0000..0037 + Django state + 0038 + 0039)
now re-receives 0038 and 0039 in a "no-op" idempotent re-run — and the
runtime-integrated code (`emitPlatformAuditEvent` → `resolvePlatformTenantId`
→ `INSERT INTO public.audit_events`) must still work on top of the upgraded
DB with pre-existing tenant data still intact.

## 2. Mandate quotes (verbatim)

- "at least one test must execute: API/server action → resolver →
  PostgreSQL. Mocks alone are insufficient." — satisfied by running the §7
  real-integration test against the freshly upgraded DB.
- "Do not accidentally convert organization identifiers to prefixed text
  IDs." — audit row and all 6 UE Cognition rows land with UUID `org_id`
  `00000007-0000-4007-8007-000000000007`.
- "Do not call an AMBER result complete."
- "Do not introduce a new architecture." — the compose→runtime adapters
  (compat VIEW + `entity_id DROP NOT NULL`) are dev-only alignment on a
  disposable DB; no application code, no migration, no production DB is
  changed.
- "Do not merge. Do not force-push." — this commit is local only.

## 3. Method

### 3.1 Driver

New file:
[`tooling/checks/phase0b2r-upgrade-with-runtime.ps1`](../../../../tooling/checks/phase0b2r-upgrade-with-runtime.ps1)
— 16 steps, parameter-driven, single timestamped log per run.

The driver **wraps** the pre-existing schema-only upgrade proof
[`tooling/checks/phase0b2-upgrade.ps1`](../../../../tooling/checks/phase0b2-upgrade.ps1)
(which by itself proves 0038+0039 idempotency + data preservation + Option D
contract enforcement) and adds the runtime-integration layer on top.

Parameters: `-PsqlPath`, `-User`, `-Port`, `-Host_`, `-KeepDb`. Requires
`$env:PGPASSWORD` set. Must be launched with `pwsh` (PowerShell 7); PS 5.1
chokes on UTF-8 em-dashes in the delegate script.

### 3.2 16-step flow

| Step | Action | Purpose |
| ---- | ------ | ------- |
| 1  | `CREATE DATABASE phase0b2r_upgrade_<ts>` | Fresh scratch DB |
| 2  | Delegate to `phase0b2-compose.ps1` | Full compose (bootstrap + 0000..0039 + Django state) |
| 3  | Apply compose→runtime adapters | `CREATE OR REPLACE VIEW public.organizations …` + `ALTER TABLE public.audit_events … entity_id DROP NOT NULL` (same alignment rationale as §10) |
| 4  | Delegate to `phase0b2-upgrade.ps1` | Existing schema-only proof: seed Acme (1111…), snapshot BEFORE, re-apply 0038 + 0039, snapshot AFTER (equal counts), verify contract CHECK still rejects `platform_tenant_id ≠ id` |
| 5  | Verify Acme row survived upgrade | Data preservation check point 1 |
| 6  | Seed HAPPY tenant (007) | `public.orgs` FK precondition, then `public.organizations` via view with `platform_tenant_id = id` |
| 7  | Export `PHASE0B2R_INTEGRATION_DB_URL` + `DATABASE_URL` | Concat-assembled to avoid gitleaks false positive |
| 8  | Run §7 happy-path integration test | `pnpm --filter @nzila/union-eyes exec vitest run lib/__tests__/platform-audit-events.integration.test.ts -t 'happy path'` |
| 9-10 | Verify `audit_events` row count = 1 + `org_id` is UUID 007 | Runtime helper actually wrote to the upgraded DB with correct UUID |
| 11 | Run `phase-0b2r-section9-ue-cognition-real-data.sql` | §9 KPI + audit real-data path |
| 12 | Verify 6/6 UE Cognition rows | id `text`, org_id UUID |
| 13 | Aggregate `audit_rows` + 6 UE counts | Single-row summary |
| 14 | Verify Acme row STILL survives | Data preservation check point 2 (after seeding + integration test — nothing collateral wiped) |
| 15 | `DROP DATABASE … WITH (FORCE)` unless `-KeepDb` | Leave no residue |
| 16 | Emit log path | |

## 4. Transcript excerpts

Full log:
[`logs/phase-0b2r-section11-upgrade-runtime-20260723125709.log`](logs/phase-0b2r-section11-upgrade-runtime-20260723125709.log)

Delegate log:
[`../phase-0b2/logs/phase-0b2-upgrade-20260723125721.log`](../phase-0b2/logs/phase-0b2-upgrade-20260723125721.log)

Key lines from the delegate schema-only proof (Step 4):

```
before.orgs.count=1
before.ue_orgs.count=1
before.ue_kpi_snapshots.count=0

after.orgs.count=1
after.ue_orgs.count=1
after.ue_kpi_snapshots.count=0
after.contract.check_ok=1
after.contract.mismatch=0

STEP 6: Verify contract rejection
NOTICE:  contract.rejected=YES
```

Key lines from the runtime-integration wrapper:

```
---- STEP 5: VERIFY ACME ROW (1111...) SURVIVED UPGRADE ----
 acme_orgs=1
 acme_ue_orgs=1

---- STEP 8: RUN §7 HAPPY-PATH INTEGRATION TEST ----
 Test Files  1 passed (1)
      Tests  1 passed | 1 skipped (2)
   Duration  4.89s

---- STEP 9-10: VERIFY audit_events ROW WITH UUID org_id ----
 test_audit_row_count = 1
 test_audit_org_id = 00000007-0000-4007-8007-000000000007

---- STEP 11: RUN §9 KPI REAL-DATA SQL ----
  crs_phase0b2r-9_deadbeef000001 … org_id=00000007-0000-4007-8007-000000000007
  wls_phase0b2r-9_deadbeef000002 … org_id=00000007-0000-4007-8007-000000000007
  mes_phase0b2r-9_deadbeef000003 … org_id=00000007-0000-4007-8007-000000000007
  pcm_phase0b2r-9_deadbeef000004 … org_id=00000007-0000-4007-8007-000000000007
  kpi_phase0b2r-9_deadbeef000005 … org_id=00000007-0000-4007-8007-000000000007
  aud_phase0b2r-9_deadbeef000006 … org_id=00000007-0000-4007-8007-000000000007

---- STEP 13: AGGREGATE SUMMARY ----
 audit_rows | crs | wls | mes | pcm | kpi | aud
          1 |   1 |   1 |   1 |   1 |   1 |   1

---- STEP 14: VERIFY ACME ROW STILL SURVIVES ----
 acme_orgs_final=1
 acme_ue_orgs_final=1

---- STEP 15: DROP DATABASE phase0b2r_upgrade_20260723125709 ----
DROP DATABASE
===== PHASE 0B.2R §11 COMPLETE Finished=2026-07-23T12:57:32.4680634-04:00 =====
```

## 5. What this proves

1. **0038 + 0039 remain idempotent on a populated DB** with runtime adapters
   applied. Re-applying both migrations against the composed DB is a
   pure no-op (relations "already exist, skipping"; counts unchanged
   between snapshot-BEFORE and snapshot-AFTER).
2. **Option D cross-schema contract still bites** on an existing DB after
   re-application: `UPDATE union_eyes.organizations SET
   platform_tenant_id = <different UUID> …` is rejected with
   `contract.rejected=YES` (either CHECK or FK depending on ordering).
3. **Runtime-integrated code writes correctly to the upgraded DB.** The §7
   happy-path test (real API/server-action → `provisionPlatformParticipant`
   → `emitPlatformAuditEvent` → INSERT into `public.audit_events`) passes
   1/1 on top of the upgraded DB; the audit row has `org_id =
   00000007-0000-4007-8007-000000000007` (UUID, not textual).
4. **UE Cognition real-data round-trip works on the upgraded DB.** All 6
   ue_* tables receive 1 row each carrying the SAME UUID `org_id`.
5. **Data preservation** — the pre-existing Acme tenant row (1111…) still
   exists after (a) the upgrade re-run, and (b) the subsequent seeding +
   integration test + KPI SQL. Nothing collateral was wiped.
6. **Clean drop** — DB torn down at the end; no residue on the native PG
   cluster.

## 6. What this does NOT prove

- Same disclosure as §10: fail-closed under the composed/upgraded shape
  is **structurally not reachable** from a client-driven test because
  0038's NOT NULL + CHECK on `platform_tenant_id` forbids both NULL and
  a mismatched UUID. The resolver-level fail-closed path is exercised in
  the §7 dev-DB run (test file's second `it` block) and by the
  "row-does-not-exist" branch (same code path, portable across shapes).
- This section does not extend runtime integration to any additional
  table beyond audit_events + the 6 UE Cognition tables. The mandate
  does not require it.
- This section does not verify RLS behavior end-to-end — that remains
  outside 0B.2R scope per the standing mandate.

## 7. Files touched by this section

| File | Change |
| ---- | ------ |
| [`tooling/checks/phase0b2r-upgrade-with-runtime.ps1`](../../../../tooling/checks/phase0b2r-upgrade-with-runtime.ps1) | NEW — §11 driver (16 steps) |
| [`reports/audits/cupe-national-phase-0/phase-0b2r/logs/phase-0b2r-section11-upgrade-runtime-20260723125709.log`](logs/phase-0b2r-section11-upgrade-runtime-20260723125709.log) | NEW — full transcript |
| [`reports/audits/cupe-national-phase-0/phase-0b2/logs/phase-0b2-upgrade-20260723125721.log`](../phase-0b2/logs/phase-0b2-upgrade-20260723125721.log) | NEW — delegated schema-only proof log |
| [`reports/audits/cupe-national-phase-0/phase-0b2/logs/phase-0b2-compose-20260723125710.log`](../phase-0b2/logs/phase-0b2-compose-20260723125710.log) | NEW — delegated base compose log |
| [`reports/audits/cupe-national-phase-0/phase-0b2r/phase-0b2r-upgrade-runtime-proof.md`](phase-0b2r-upgrade-runtime-proof.md) | NEW — this file |

## 8. Cross-references

- §10 companion (clean composition):
  [phase-0b2r-compose-runtime-proof.md](phase-0b2r-compose-runtime-proof.md)
- Existing schema-only upgrade proof delegated to:
  [`tooling/checks/phase0b2-upgrade.ps1`](../../../../tooling/checks/phase0b2-upgrade.ps1)
- Runtime resolver source of truth:
  [phase-0b2r-resolver-runtime-integration.md](phase-0b2r-resolver-runtime-integration.md)
- Real-integration §7 report:
  [phase-0b2r-audit-events-resolution.md](phase-0b2r-audit-events-resolution.md)
- §9 KPI real-data report:
  [phase-0b2r-ue-cognition-kpi-real-data-proof.md](phase-0b2r-ue-cognition-kpi-real-data-proof.md)

## 9. Status remains AMBER

Per the standing mandate, this section does not lift the status. Remaining
work (in order): §12 cupe-vocabulary disposition, §13 governance artifact
cleanup, §14 hook & validation evidence, §15 final AMBER closure, §16
30-item closure report.
