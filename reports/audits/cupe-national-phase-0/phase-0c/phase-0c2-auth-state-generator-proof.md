# Phase 0C.2 §12 — Auth-state Generator Proof

**Generated:** 2026-07-23T22:39:20.907Z
**Harness:** `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-auth-state-generator.ts`
**Generator:** `apps/union-eyes/scripts/lifecycle/generate-auth-states.ts`

---

## Step 1 — Allocate free port

- port: `3012`

## Step 2 — Allocate disposable DB (compliant bootstrap)

- dbName: `ue_e2e_20260723223920_e60981`
- runId: `20260723223920_e60981`

## Step 3 — Seed test fixtures

- exit code: `0`
- duration: `34.55s`

## Step 4 — Boot Next.js dev server (owned + PID-tracked)

- pid: `30728`
- log: `apps/union-eyes/.e2e-lifecycle/runs/20260723223920_e60981/server.log`

## Step 5 — Poll `/api/health/liveness` until 200 (timeout 180s)

- ready: `true`
- attempts: `4`
- elapsedMs: `18074`

## Step 6 — Run auth-state generator (5 canonical personas)

- baseUrl: `http://localhost:3012`
- outputDir: `apps/union-eyes/playwright/.auth`
- duration: `4.86s`
- allOk: `true`

| Role | Email | Login | Me | Me email match | Cookie | Storage | OK |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| member | `ue.qa.member.primary@nzila.test` | `200` | `200` | ✅ | ✅ | ✅ | ✅ |
| steward | `ue.qa.steward.primary@nzila.test` | `200` | `200` | ✅ | ✅ | ✅ | ✅ |
| staff | `ue.qa.staff.primary@nzila.test` | `200` | `200` | ✅ | ✅ | ✅ | ✅ |
| executive | `ue.qa.executive.primary@nzila.test` | `200` | `200` | ✅ | ✅ | ✅ | ✅ |
| admin | `ue.qa.admin.primary@nzila.test` | `200` | `200` | ✅ | ✅ | ✅ | ✅ |

## Step 7 — Validate storageState files on disk

| Role | Path | Issues |
|---|---|---|
| member | `apps/union-eyes/playwright/.auth/member.json` | ✅ ok |
| steward | `apps/union-eyes/playwright/.auth/steward.json` | ✅ ok |
| staff | `apps/union-eyes/playwright/.auth/staff.json` | ✅ ok |
| executive | `apps/union-eyes/playwright/.auth/executive.json` | ✅ ok |
| admin | `apps/union-eyes/playwright/.auth/admin.json` | ✅ ok |

## Step 8 — Stop server (governed SIGTERM → SIGKILL)

- stopped: `true`
- method: `sigterm`
- pid: `30728`

## Step 9 — Verify port release

- port 3012 free: `true`

## Step 10 — Drop disposable DB

- drop: `{"dropped":true}`

---

## Verdict

**✅ PASS** — Phase 0C.2 §12 auth-state generator proof.

All 5 canonical Union Eyes QA personas (member, steward, staff, executive, admin) successfully authenticated via `POST /api/auth/login`, verified via `GET /api/auth/me` (email match), and produced valid Playwright `storageState` JSON files under `apps/union-eyes/playwright/.auth/` — each containing a single httpOnly `nzila_session` cookie scoped to `localhost` with a future expiry. Server stopped via SIGTERM; port released; DB dropped clean.
