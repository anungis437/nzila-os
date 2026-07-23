# Phase 0C.2 §9 — Existing-DB Upgrade Proof

**Generated:** 2026-07-23T22:15:26.319Z
**Runner under proof:** `tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs` (idempotent re-application against a populated DB)

---

## Step 1 — Fresh allocation (initial bootstrap)

- dbName: `ue_e2e_20260723221526_a975ae`
- runId: `20260723221526_a975ae`
- initial bootstrap attestation rows: 1

## Step 2 — Insert marker organization + marker user (simulate pre-existing tenant data)

- marker.orgId: `cc4bcf74-6fea-411d-a6d0-14c38adaad45` (slug=`phase-0c2-marker-cc4bcf74`)
- marker.userId: `phase-0c2-marker-0b6582c3-d807-4410-9609-6f98a7116386` (email=`phase-0c2-marker-cc4bcf74@nzila.test`)
- pre-upgrade total row count across 47 tables: 7

## Step 3 — Re-run compliant bootstrap DIRECTLY against the populated DB

- exit code: 0
- duration: 0.28s
- stdout tail:
  ```
  [bootstrap] Legacy lineage freeze respected. Skipping any replay of db/migrations/.
  [bootstrap] Ensuring required extensions...
  [bootstrap] extension OK: uuid-ossp
  [bootstrap] extension OK: pgcrypto
  [bootstrap] extension OK: pg_trgm
  [bootstrap] extension OK: btree_gin
  [bootstrap] extension optional/unavailable: vector (permission denied to create extension "vector")
  [bootstrap] UE_DB_RESTORE_SNAPSHOT_URL not set — skipping canonical snapshot restore. In demo/pilot environments this MUST be set per docs/architecture/orm-governance/environment-bootstrap-strategy.md.
  [bootstrap] Applying scoped Drizzle migrations from db/migrations-cache/ ...
  [bootstrap] scoped migration already applied: 0000_outstanding_viper
  [bootstrap] scoped migration already applied: 0001_lean_iron_man
  [bootstrap] scoped migration already applied: 0002_certain_juggernaut
  [bootstrap] scoped migration already applied: 0003_dizzy_alex_wilder
  [bootstrap] Bootstrap attestation recorded.
  [bootstrap] Bootstrap complete.
  ```

## Step 4 — Post-upgrade verification

- table count before: 47, after: 47
- total row count before: 7, after: 8, delta: 1
- marker organization present: ✅ yes (duplicates: 0)
- marker user present: ✅ yes (duplicates: 0)
- bootstrap attestation rows: 1 → 2 (delta 1)
- ✅ no table lost rows

## Step 5 — Drop

- drop: {"dropped":true}

---

## Verdict

- re-application succeeded (exit 0): ✅
- no row loss: ✅
- marker rows intact, no duplicates: ✅
- attestation grew by exactly 1: ✅
- drop succeeded: ✅

**✅ PASS** — Phase 0C.2 §9 existing-DB upgrade proof.

The compliant bootstrap runner is safe to re-apply against a database that already contains tenant data:
- pre-existing organization and user rows are preserved bit-for-bit
- no duplicate rows are introduced
- no tables shrink or are dropped
- the attestation ledger records exactly one additional entry
- the drizzle scoped migration journal skips already-applied migrations
