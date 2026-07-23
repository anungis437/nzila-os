# Phase 0C.2 §10 — Seed / Reset Completion Proof

**Generated:** 2026-07-23T22:19:54.730Z
**Harness:** `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-seed-reset.ts`
**Seed script under proof:** `apps/union-eyes/scripts/seed-test-env.ts`

---

## Step 1 — Allocate disposable DB (compliant bootstrap)

- dbName: `ue_e2e_20260723221954_f64651`
- runId: `20260723221954_f64651`

## Step 2 — Run seed (initial)

- exit code: `0`
- duration: `34.34s`

## Step 3 — Verify fixture rows persisted

| Table | Actual | Expected | OK? |
|---|---:|---:|:---:|
| organizations (expected 3) | 3 | 3 | ✅ |
| user_management.users (expected 10) | 10 | 10 | ✅ |
| user_management.organization_users (expected 10) | 10 | 10 | ✅ |
| public.claims (expected 3) | 3 | 3 | ✅ |
| public.organization_members (expected 10) | 10 | 10 | ✅ |
| user_management.org_auth_policies (expected 3) | 3 | 3 | ✅ |
| user_management.user_sessions (expected 10) | 10 | 10 | ✅ |

## Step 4 — Verify 5 canonical primary personas present by email

| Persona | Email | Present? |
|---|---|:---:|
| admin | `ue.qa.admin.primary@nzila.test` | ✅ |
| executive | `ue.qa.executive.primary@nzila.test` | ✅ |
| member | `ue.qa.member.primary@nzila.test` | ✅ |
| staff | `ue.qa.staff.primary@nzila.test` | ✅ |
| steward | `ue.qa.steward.primary@nzila.test` | ✅ |

## Step 5 — Re-run seed (idempotency)

- exit code: `0`
- duration: `34.39s`

## Step 6 — Verify counts unchanged (no duplicates)

- ✅ all fixture counts unchanged after re-seed

## Step 7 — Drop disposable DB

- drop: `{"dropped":true}`

---

## Verdict

**✅ PASS** — Phase 0C.2 §10 seed / reset completion proof.

The deterministic seed pipeline succeeds against a bootstrap-only disposable DB, the 4 canonical fixture orgs, 10 fixture users (5 canonical primary personas), and 3 fixture claims are persisted, and re-running the seed does NOT introduce duplicate rows.
