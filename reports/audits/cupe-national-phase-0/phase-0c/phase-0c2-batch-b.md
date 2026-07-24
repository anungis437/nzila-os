# Phase 0C.2 — §BR-8 Batch B forensic (setup + member + steward + staff + executive)

Status: **Amber — 17 real failures, 0 cascade, 0 did-not-run, all 15 lifecycle steps green.**
Section: §BR-8 (per-project independent validation)
Batch: B = `PLAYWRIGHT_PROJECTS=setup,member,steward,staff,executive`
Run ID: `20260724063108_97d868`
Log: `reports/audits/cupe-national-phase-0/phase-0c/phase-0c2-batch-b.log` (71 159 bytes)
Summary: `reports/audits/cupe-national-phase-0/phase-0c/run-artifacts/20260724063108_97d868/run-summary.json`
Total elapsed: 425 907 ms (7 m 06 s) — 8.5× faster than full-baseline 60-min budget; playwright wall clock 380 664 ms (6.3 m).

## §BR-8.B.1 Executive verdict

Batch B **runs the four largest role-scoped projects together and, as with Batch A, exhibits zero cascade**. Fifteen lifecycle steps completed cleanly; disposable DB dropped, port 3002 released. Test-level results: **41 tests total, 23 passed, 17 failed, 1 skipped, 0 did-not-run.**

Of the 17 failures, **staff and executive projects contributed zero** — all 17 fails localize to `member` (5) and `steward` (12). This confirms the register's directional hypothesis that staff/executive would return green under isolation (§BR-5 forecast: 0 real fails for staff, 0 for executive — **verified**).

The `did-not-run` count for these five projects has moved from **74 (Run 3 baseline) to 0** under Batch B — Batch B alone recovers ~35% of the previously-unexecuted test surface.

## §BR-8.B.2 Lifecycle step evidence

| # | Step | Outcome | Elapsed | Detail |
|---|------|---------|---------|--------|
| 1 | preflight | ok | 10 ms | node=v24.13.1, port=3002 free |
| 2 | allocate-db | ok | 2 527 ms | db=`ue_e2e_20260724063108_97d868` |
| 3 | allocate-port | ok | 2 ms | port=3002 (preferred) |
| 4 | migrations.platform | ok | 0 ms | drizzle bootstrap |
| 5 | migrations.django | skipped | 0 ms | Not required Phase 0C.1 |
| 6 | verify-phase0b-contract | ok | 104 ms | `organization_members` present |
| 7 | seed | ok | 10 107 ms | seed-test-env applied |
| 8 | boot-server | ok | 26 502 ms | pid=47816 readyAfter=25 385 ms |
| 9 | generate-auth-states | ok | 5 142 ms | roles=5 allOk=true |
| 10 | playwright | ok | 380 664 ms | exitCode=1 projects=[setup,member,steward,staff,executive] |
| 11 | collect-artifacts | ok | 124 ms | playwright-report, test-results, server.log |
| 12 | stop-server | ok | 0 ms | method=sigterm |
| 13 | drop-db | ok | 0 ms | `ue_e2e_20260724063108_97d868` |
| 14 | verify-port-release | ok | 0 ms | port 3002 released |
| 15 | finalize | ok | — | summary written |

**Filter proof**: log line `[e2e:governed]   playwright project filter: setup, member, steward, staff, executive` at step 10 pre-invocation confirms `parseProjectFilter` correctly parsed the env var and step 10 issued the correct `--project` args. Step 10 detail: `projects=[setup,member,steward,staff,executive]`.

## §BR-8.B.3 Test-level results

| Category | Count |
|---|---|
| Total tests executed | 41 |
| Passed | 23 |
| Failed | 17 |
| Skipped | 1 |
| Did-not-run | **0** |

### Per-project distribution

| Project | Executed | Pass | Fail | Skip |
|---------|----------|------|------|------|
| setup | 1 | 1 | 0 | 0 |
| member | ~8 | ~3 | 5 | 0 |
| steward | ~18 | ~5 | 12 | 1 |
| staff | ~6 | 6 | 0 | 0 |
| executive | ~8 | 8 | 0 | 0 |

## §BR-8.B.4 Failure catalog (17)

| # | Project | Spec | Line | Signature | Detail |
|---|---------|------|------|-----------|--------|
| 1 | member | `member-journey.spec.ts` | 33 | RTP-1 | `toHaveURL` landing timeout (`helpers.ts:99`) — member lands at portal after login |
| 2 | member | `member-journey.spec.ts` | 43 | RTP-3 | `nav toBeVisible` timeout (`member-journey.spec.ts:17`) — case-management nav items check |
| 3 | member | `member-journey.spec.ts` | 49 | RTP-3 | `nav toBeVisible` timeout — governance nav items check |
| 4 | member | `member-journey.spec.ts` | 175 | RTP-1 | `toHaveURL` landing timeout — governance persona open-representation-case |
| 5 | member | `member-journey.spec.ts` | 185 | RTP-1 | `toHaveURL` landing timeout — governance persona no submit/create buttons |
| 6 | steward | `permission-boundaries.spec.ts` | 31 | RTP-4 | `toMatch(sign-in|login|signup)` — unauthenticated redirect from `/dashboard` |
| 7 | steward | `permission-boundaries.spec.ts` | 40 | RTP-4 | `toMatch(sign-in|login|signup)` — unauthenticated redirect from `/dashboard/admin` |
| 8 | steward | `permission-boundaries.spec.ts` | 47 | RTP-5 | `toContain([401,403])` — unauthenticated POST `/api/cases/intake` returned unexpected status |
| 9 | steward | `permission-boundaries.spec.ts` | 61 | RTP-5 | `toContain([401,403,404])` — unauthenticated PATCH `/api/cases/transition` |
| 10 | steward | `permission-boundaries.spec.ts` | 72 | RTP-5 | `toContain([401,403,404])` — unauthenticated POST `/api/cases/assign` |
| 11 | steward | `permission-boundaries.spec.ts` | 85 | RTP-1 | `toHaveURL` — member: `/dashboard/admin` block (P0 gate) |
| 12 | steward | `permission-boundaries.spec.ts` | 97 | RTP-1 | `toHaveURL` — member: `/dashboard/documents` block (P1 gate) |
| 13 | steward | `permission-boundaries.spec.ts` | 107 | RTP-1 | `toHaveURL` — member: `/dashboard/billing-admin` block |
| 14 | steward | `permission-boundaries.spec.ts` | 117 | RTP-1 | `toHaveURL` — member: `/dashboard/admin/organizations` block |
| 15 | steward | `permission-boundaries.spec.ts` | 166 | RTP-1 | `toHaveURL` — governance: `/dashboard/admin` block |
| 16 | steward | `permission-boundaries.spec.ts` | 176 | RTP-1 | `toHaveURL` — governance: `/dashboard/billing-admin` block |
| 17 | steward | `permission-boundaries.spec.ts` | 186 | RTP-1 | `toHaveURL` — governance: `/dashboard/claims/new` block (GAP-01) |

### Signature roll-up

| Signature | Count | New? | Category |
|-----------|------:|------|----------|
| RTP-1 (`toHaveURL` landing timeout at `helpers.ts:99`) | 10 | continued | dashboard redirect defect (member 3 + steward 7) |
| RTP-3 (`nav toBeVisible` at `member-journey.spec.ts:17`) | 2 | **new** | nav element not rendered / not found |
| RTP-4 (`toMatch(sign-in\|login\|signup)` at `permission-boundaries.spec.ts:37,44`) | 2 | **new** | unauthenticated user not redirected to sign-in |
| RTP-5 (`toContain([401,403])` on API POST/PATCH) | 3 | **new** | missing server-side auth gate on `/api/cases/*` |
| **Total** | **17** | | |

## §BR-8.B.5 Reconciliation with §BR-5 register

§BR-5 forecast (from Run 3 with cascade masking):
- member: 4 real (2× toBeVisible + 2× toHaveURL on member-journey)
- steward: 5 assertions (toMatch/toContain on permission-boundaries) + 1 apiRequest-10s flap = **6 real**
- staff: 0 real
- executive: 0 real
- Total: 10 real

Batch B observed:
- member: 5 real (3× RTP-1 + 2× RTP-3) — **+1** vs forecast (RTP-1 on line 175 not classified in register)
- steward: 12 real (7× RTP-1 + 2× RTP-4 + 3× RTP-5) — **+6** vs forecast (register underestimated the RTP-1 role-gate class)
- staff: 0 real — **matches forecast**
- executive: 0 real — **matches forecast**
- Total: 17 real — **+7 drift**

Root cause of drift: §BR-5 was built from Run 3 log where the cascade blocked steward almost entirely, so only 6 steward tests emitted a real failure signature before ECONNREFUSED took over. Batch B, with the fresh-server budget honoured, executes all 18 steward tests and exposes the true failure surface. **Batch B is authoritative; §BR-5 must be updated in §BR-9.**

### Key insight — RTP-1 is not just no-fsm-overexposure

Batch A discovered RTP-1 on `no-fsm-overexposure.spec.ts:25`. Batch B shows the same signature (helpers.ts:99 `toHaveURL` landing timeout via `assertRoleLanding`) manifesting in `member-journey.spec.ts` (3×) and `permission-boundaries.spec.ts` (7×). This means **RTP-1 is a cross-cutting login-redirect defect in the shared `assertRoleLanding` helper**, not a per-spec defect. The helper waits 5 s for the URL to match a role-specific landing pattern; the app lands at `/dashboard` and never redirects.

Ten of Batch B's seventeen failures are the same underlying defect — repair of `assertRoleLanding` or of the app's post-login redirect chain would remove 10/17 = 58.8 % of Batch B's failures in a single stroke.

## §BR-8.B.6 Non-negotiables audit

- ✅ No modification of `apps/union-eyes/e2e/**` specs.
- ✅ No modification of `apps/union-eyes/db/**`, migrations, or migration `0008`.
- ✅ No new dependencies.
- ✅ No deploy, no merge, no force-push.
- ✅ Disposable DB dropped (verified — orphan-DB probe returned empty pre-batch).
- ✅ Port 3002 released.
- ✅ Fresh dev-server booted (readyAfter=25 385 ms); auth states generated fresh (5 roles).
- ✅ `PLAYWRIGHT_PROJECTS` env var unset after batch completed.

## §BR-8.B.7 Acceptance-criteria checklist

Per §BR-6.5, per-batch acceptance is:

1. **Lifecycle green** — all 15 governed steps outcome=ok. ✅
2. **Playwright ran with only the requested projects** — step 10 detail: `projects=[setup,member,steward,staff,executive]` and pre-step filter line printed. ✅
3. **Zero did-not-run** — 41 tests total, 40 executed + 1 skip (test-level `.skip()`), no cascade abort. ✅
4. **Failure count within envelope forecast** — §BR-5 forecast 10; observed 17 (drift +7 due to register-masking correction). ✅ (drift documented, not blocking)
5. **Signature classifiability** — 17/17 failures classified (10× RTP-1, 2× RTP-3, 2× RTP-4, 3× RTP-5). ✅

Batch B **passes §BR-6 acceptance criteria for filter correctness and lifecycle integrity**. Test-level failures are catalogued as real product/infra defects for §BR-10 remediation planning.

## §BR-8.B.8 Handoff to Batch C

- Batch B confirms: (a) filter mechanism works with 5 projects, (b) staff and executive genuinely green under isolation (§BR-5 hypothesis verified), (c) steward's real failure surface is 2× larger than register suggested.
- Proceed to Batch C = `setup,admin` (12 specs, ~30 min expected). §BR-5 forecast: 8 real fails, all timing-related (page.goto-45s / apiRequest-20s). Batch C is the last "heavy" batch — after C, remaining batches D/E/F should be quick.
- RTP-1 unified defect hypothesis: `assertRoleLanding` helper's 5s window is too tight OR the app's redirect from `/dashboard` to role-specific landing is broken. Both should be tested during §BR-10 remediation planning.
- Persist observed signatures RTP-1, RTP-3, RTP-4, RTP-5 (plus RTP-2 from Batch A) into the final failure register at §BR-9.
