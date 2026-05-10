# One-Week Sprint — Enterprise Readiness Hardening

**Target:** Close all GA-blocking gaps from the Enterprise Stress Test  
**Start date:** 2026-02-23 (Monday)  
**End date:** 2026-02-27 (Friday)  
**Terminology:** Org / Org isolation (no "tenant")

---

## Sprint Goal

Promote the repo from **CONDITIONAL YES** to **UNCONDITIONAL YES** by closing:

1. ❌ FAIL: Rate limiting on Next.js apps (REM-01)
2. 🟡 SOFT PASS (Critical): Runtime Org isolation test harness (REM-02)
3. 🟡 SOFT PASS (Critical): Privilege escalation regression tests (REM-03)
4. 🟡 SOFT PASS (Critical): `DATA_EXPORT` audit action (REM-04)
5. 🟡 SOFT PASS (HIGH): Health/readiness routes (REM-05)

---

## Day-by-Day Plan

### Pre-Sprint — Branch Protection (REM-12) — 30 minutes, do before Monday

**Owner:** Platform Owner / Repo Admin  
**Goal:** Enable GitHub branch protection on `main` before any sprint PR is merged

| # | Task | How | DoD |
|---|------|-----|-----|
| P1 | Enable branch protection on `main` | GitHub Settings → Branches → Add rule OR `gh api` CLI (see REM-12 in REMEDIATION_PLAN.md) | `gh api .../branches/main/protection` returns 200 |
| P2 | Set required status checks: `lint-and-typecheck`, `test`, `build`, `contract-tests` | Same rule | All four appear as required checks |
| P3 | Enable "Dismiss stale reviews" + "Include administrators" | Same rule | Enforcement applies to all committers |

**Acceptance:** `gh api /repos/{owner}/{repo}/branches/main/protection --jq '.required_status_checks.contexts'` returns the four required checks.

> **Why first:** Without branch protection, every PR merged during the sprint could bypass CI. This is a 30-minute configuration task, not a code change.

---

### Monday 2026-02-23 — Rate Limiting (REM-01)

**Owner:** Backend / Platform  
**Goal:** Console + Partners API routes protected by application-layer rate limiting

| # | Task | Files | DoD |
|---|------|-------|-----|
| M1 | Add `@arcjet/next` to console + partners packages | `apps/console/package.json`, `apps/partners/package.json` | `pnpm install` succeeds |
| M2 | Create `lib/arcjet.ts` in console and partners | `apps/console/lib/arcjet.ts`, `apps/partners/lib/arcjet.ts` | Arcjet client configured with token bucket (100 cap, 60 req/min refill) |
| M3 | Wrap `authMiddleware` with Arcjet in both middlewares | `apps/console/middleware.ts`, `apps/partners/middleware.ts` | 429 returned when limit exceeded |
| M4 | Add `ARCJET_KEY` env var to env contracts | `apps/console/lib/env.ts` (or equivalent), `.env.example` | `env-contract.test.ts` still passes |
| M5 | Write `rate-limiting.test.ts` contract test | `tooling/contract-tests/rate-limiting.test.ts` | Static assertion that middleware imports rate limiter |
| M6 | PR, CI green, merge | — | `contract-tests` job passes in CI |

**Acceptance:** `grep` for `arcjet\|rateLimit` in `apps/console/middleware.ts` returns match.

---

### Tuesday 2026-02-24 — Health Routes (REM-05)

**Owner:** Platform  
**Goal:** `/api/health` and `/api/ready` in console + partners

| # | Task | Files | DoD |
|---|------|-------|-----|
| T1 | Create `app/api/health/route.ts` for console + partners | 2 files | Returns `{ status: 'ok' }` with 200 |
| T2 | Create `app/api/ready/route.ts` for console + partners | 2 files | Returns 200 if DB responds to `SELECT 1`, else 503 |
| T3 | Verify `/api/health` is in `isPublicRoute` allowlist | `apps/console/middleware.ts` | No 401 on unauthenticated health check |
| T4 | Write `health-routes.test.ts` contract test | `tooling/contract-tests/health-routes.test.ts` | Asserts both route files exist in both apps |
| T5 | PR, CI green, merge | — | `contract-tests` job passes |

**Acceptance:** `existsSync('apps/console/app/api/health/route.ts')` → true.

---

### Wednesday 2026-02-25 — DATA_EXPORT Audit Action (REM-04)

**Owner:** Core / Audit  
**Goal:** `DATA_EXPORT` in taxonomy; export routes wired

| # | Task | Files | DoD |
|---|------|-------|-----|
| W1 | Add `DATA_EXPORT`, `DATA_EXPORT_REQUEST`, `AUTH_CONFIG_CHANGE` to `AUDIT_ACTIONS` | `apps/console/lib/audit-db.ts` | New constants present |
| W2 | Identify all export-generating routes in console | `apps/console/app/api/**/route.ts` | List of routes (year-end, cap-table export, document download) |
| W3 | Wire `recordAuditEvent({ action: AUDIT_ACTIONS.DATA_EXPORT })` in each export route | Identified route files | Each export route calls `recordAuditEvent` |
| W4 | Write `audit-taxonomy.test.ts` contract test | `tooling/contract-tests/audit-taxonomy.test.ts` | Asserts `DATA_EXPORT` defined; asserts export routes call `recordAuditEvent` |
| W5 | PR, CI green, merge | — | `audit-immutability.test.ts` + new `audit-taxonomy.test.ts` both pass |

**Acceptance:** `AUDIT_ACTIONS.DATA_EXPORT` defined; contract test passes.

---

### Thursday 2026-02-26 — Org Isolation Runtime Tests (REM-02)

**Owner:** Security / Platform  
**Goal:** HTTP-level cross-org breach scenarios automated

| # | Task | Files | DoD |
|---|------|-------|-----|
| Th1 | Create `fixtures/orgs.ts` with OrgA + OrgB seeded fixtures and mock auth session headers | `tooling/contract-tests/fixtures/orgs.ts` | OrgA and OrgB fixtures with distinct `orgId` values |
| Th2 | Create `org-isolation-runtime.test.ts` | `tooling/contract-tests/org-isolation-runtime.test.ts` | Test A (cross-org READ), Test B (cross-org WRITE), Test C (missing context → 401) |
| Th3 | Add Test D (forged orgId in body ignored) + Test E (no org ID in error message) | Same file | All 5 tests present |
| Th4 | Configure test runner to handle Next.js route handlers (use `next/test-utils` or mock `auth()`) | `tooling/contract-tests/vitest.config.ts` | Tests run without requiring a live server |
| Th5 | PR, CI green, merge | — | `org-isolation-runtime.test.ts` (5 tests) pass |

**Acceptance:** `org-isolation-runtime.test.ts` — 5/5 tests pass in `pnpm contract-tests`.

---

### Friday 2026-02-27 — Privilege Escalation Tests (REM-03) + Sprint Review

**Owner:** Security  
**Goal:** Role escalation regressions automated; sprint sign-off

| # | Task | Files | DoD |
|---|------|-------|-----|
| F1 | Create `privilege-escalation.test.ts` | `tooling/contract-tests/privilege-escalation.test.ts` | Tests: `console:admin` cannot reach `SUPER_ADMIN`-only scope; self-elevation via body ignored; `partner:channel_sales` cannot do `channel_admin` actions |
| F2 | Add `AUTHORIZATION_DENIED: 'authorization.denied'` to `AUDIT_ACTIONS` | `apps/console/lib/audit-db.ts` | Constant present |
| F3 | Wire audit emit on `AuthorizationError` in `authorize()` | `packages/os-core/src/policy/authorize.ts` | Optional warn-level log at minimum; audit event at best |
| F4 | PR, CI green, merge | — | `privilege-escalation.test.ts` passes |
| F5 | **Sprint review** — re-run full stress test checklist | `docs/stress-test/ENTERPRISE_STRESS_TEST.md` | Update all ❌/🟡 items to ✅ for closed items |
| F6 | Update `ENTERPRISE_STRESS_TEST.md` final verdict | `docs/stress-test/ENTERPRISE_STRESS_TEST.md` | Verdict upgraded from CONDITIONAL YES → UNCONDITIONAL YES |
| F7 | Fill in `GA_CERTIFICATION_REPORT.md` §5.1–5.6 (red team simulation) | `docs/ga/GA_CERTIFICATION_REPORT.md` | All 6 sections completed and signed |

---

## Success Criteria (End of Sprint)

| Item | Target |
|------|--------|
| `pnpm contract-tests` | All tests pass (≥ 280 tests) |
| Branch protection (REM-12) | `main` has required checks; direct push blocked |
| Rate limiting | `apps/console/middleware.ts` and `apps/partners/middleware.ts` invoke limiter |
| Org isolation runtime | 5 HTTP-level breach tests passing |
| `DATA_EXPORT` in `AUDIT_ACTIONS` | Present + wired to export routes |
| Health routes | `/api/health` + `/api/ready` in console + partners |
| Privilege escalation | ≥ 3 regression tests passing |
| Final stress test verdict | `Enterprise-ready: YES (UNCONDITIONAL)` |

---

## Post-Sprint Backlog (Next 2 Weeks)

| Item | Ref | Effort |
|------|-----|--------|
| CSP nonce hardening | REM-06 | 1 day |
| Audit chain verify API endpoint | REM-07 | 0.5 day |
| `pnpm run secret-scan` script | REM-08 | 1 hour |
| Call-site audit coverage tests | REM-09 | 0.5 day |
| `AUTH_CONFIG_CHANGE` audit action | REM-10 | 0.5 day |
| `/verify-chain` API endpoint | REM-07 | 1 day |
| Audit DB-level write constraints (trigger/RLS) | REM-11 | 0.5 day |
| Org ID in `RequestContext` + logs | REM-13 | 0.5 day |
| Migration rollback runbook | (new) | 0.5 day |

---

## Gating Rule

> **No enterprise customer contracts may be signed until Day 5 sign-off is complete.**  
> Branch protection (REM-12) must be configured **before** the sprint starts — it's a 30-minute prerequisite.  
> Rate limiting (REM-01) and Org isolation runtime proofs (REM-02) are the highest-risk items and must be merged first.  
> The full GA certification sequence is documented in [`docs/ga/GA_READINESS_GATE.md`](../ga/GA_READINESS_GATE.md).
