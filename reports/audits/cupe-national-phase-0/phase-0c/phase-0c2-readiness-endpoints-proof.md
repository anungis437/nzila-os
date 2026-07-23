# Phase 0C.2 §11 — Readiness Authoritative Endpoints Proof

**Generated:** 2026-07-23T22:23:37.250Z
**Harness:** `apps/union-eyes/scripts/lifecycle/prove-phase-0c2-readiness-endpoints.ts`

---

## Step 1 — Allocate free port

- port: `3011`

## Step 2 — Allocate disposable DB (compliant bootstrap)

- dbName: `ue_e2e_20260723222337_0253aa`
- runId: `20260723222337_0253aa`

## Step 3 — Seed test fixtures

- exit code: `0`
- duration: `37.16s`

## Step 4 — Boot Next.js dev server (owned + PID-tracked)

- pid: `56008`
- log: `apps/union-eyes/.e2e-lifecycle/runs/20260723222337_0253aa/server.log`

## Step 5 — Poll `/api/health/liveness` until 200 (timeout 180s)

- ready: `true`
- attempts: `5`
- elapsedMs: `38943`
- lastStatus: `200`

## Step 6 — GET `/api/health/liveness` — assert shape

- status: `200`
- body:
  ```json
  {"status":"ok","timestamp":"2026-07-23T22:24:57.722Z","uptime":37.1730302}
  ```

## Step 7 — GET `/api/health` — assert canonical contract

- status: `200`
- body:
  ```json
  {"ok":true,"status":"healthy","app":"union-eyes","environment":"development","timestamp":"2026-07-23T22:25:00.212Z","version":"0.0.0","checks":{"process":{"status":"ok"},"database":{"status":"ok","critical":true,"ms":223},"auth":{"status":"ok","critical":true},"redis":{"status":"ok","note":"Redis not configured — optional for this deployment"},"backend":{"status":"ok","note":"Django backend not configured — optional"}}}
  ```

| Check | Actual | Expected | OK? |
|---|---|---|:---:|
| process | `ok` | `ok` | ✅ |
| database | `ok` | `ok` | ✅ |
| auth | `ok` | `ok` | ✅ |


## Step 8 — GET `/api/auth_core/health` — assert proxies to canonical

- status: `200`
- body:
  ```json
  {"ok":true,"status":"healthy","app":"union-eyes","environment":"development","timestamp":"2026-07-23T22:25:01.693Z","version":"0.0.0","checks":{"process":{"status":"ok"},"database":{"status":"ok","critical":true,"ms":186},"auth":{"status":"ok","critical":true},"redis":{"status":"ok","note":"Redis not configured — optional for this deployment"},"backend":{"status":"ok","note":"Django backend not configured — optional"}}}
  ```

## Step 9 — Stop server (governed SIGTERM → SIGKILL)

- stopped: `true`
- method: `sigterm`
- pid: `56008`

## Step 10 — Verify port release

- port 3011 free: `true`

## Step 11 — Drop disposable DB

- drop: `{"dropped":true}`

---

## Verdict

**✅ PASS** — Phase 0C.2 §11 readiness authoritative endpoints proof.

The Union Eyes Next.js server, when booted against a bootstrap-only + seeded disposable DB, responds to `/api/health/liveness`, `/api/health`, and `/api/auth_core/health` on the authoritative contract: HTTP 200, `ok=true`, process/database/auth checks all `ok`, `app="union-eyes"`, and all required metadata fields present.
