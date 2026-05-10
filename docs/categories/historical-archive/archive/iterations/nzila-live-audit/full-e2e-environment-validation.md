# 06 — Full E2E Environment Validation

**Authority:** Coverage of complete operational journeys across dev / staging / demo.
**Source anchors:**
[apps/union-eyes/tests/e2e/](../../apps/union-eyes/tests/e2e/),
[.github/workflows/e2e.yml](../../.github/workflows/e2e.yml).

---

## 1. Existing E2E Coverage

### 1.1 Union Eyes (Playwright, 91 tests, 1 worker, sequential)

| Spec                              | Journey                                                | Verdict   |
|-----------------------------------|--------------------------------------------------------|-----------|
| `auth-session-switch.spec.ts`     | Sequential login replaces session + role context       | LIVE      |
| `member-intake.spec.ts`           | Member files grievance                                 | LIVE      |
| `steward-review.spec.ts`          | Steward reviews grievance                              | LIVE      |
| `admin-assignment.spec.ts`        | Admin assigns; member denied                           | LIVE      |
| `auditor-readonly.spec.ts`        | Read-only auditor boundary                             | LIVE      |
| `cross-org-block.spec.ts`         | Cross-org access denied                                | LIVE      |
| `case-escalation.spec.ts`         | Case escalates through state machine                   | LIVE      |
| `case-resolution.spec.ts`         | Case reaches resolved/closed                           | LIVE      |
| `external-ux-tester.spec.ts`      | Sandbox containment                                    | LIVE      |
| `ue-workflow.spec.ts`             | End-to-end intake→review→assign→escalate→resolve       | `testIgnore` (gated) |

### 1.2 Cross-app E2E

| App              | E2E coverage                              | Verdict      |
|------------------|-------------------------------------------|--------------|
| web              | Smoke (Playwright)                        | LIVE         |
| console          | Smoke (Playwright)                        | LIVE         |
| union-eyes       | Full suite (above)                        | LIVE         |
| flow             | Smoke                                     | LIVE         |
| partners         | Smoke (root 404 known)                    | PARTIAL      |
| cfo              | Smoke                                     | LIVE         |
| control-plane    | Smoke                                     | LIVE         |
| zonga            | Unit + contract; **no Playwright suite**  | GAP          |
| abr              | None (BLOCKED)                            | GAP          |
| agrimo, cora, trade, mobility | None                       | DEFERRED     |

---

## 2. Required Operational Journeys (per audit prompt)

| Journey                        | Coverage           | Where                                  | Verdict       |
|--------------------------------|--------------------|----------------------------------------|---------------|
| Onboarding                     | UE intake          | `member-intake.spec.ts`                | LIVE (UE only) |
| Auth                           | Session switching  | `auth-session-switch.spec.ts`          | LIVE          |
| Governance review              | Auditor read-only  | `auditor-readonly.spec.ts`             | LIVE (read-only) |
| Grievance continuity           | Full lifecycle     | `case-escalation` + `case-resolution`  | LIVE          |
| Rollout review                 | `pnpm validate:rollout-legitimacy` | tooling validator           | LIVE (CI)     |
| Rollback review                | Container app revision rollback     | manual procedure         | DOCUMENTED, NOT AUTOMATED |
| Restoration review             | PG PITR + storage replay            | manual procedure         | DOCUMENTED, NOT AUTOMATED |
| Executive review               | Executive persona dashboard         | TBD (no E2E spec)        | GAP           |
| Procurement walkthrough        | Pilot evidence manifest             | `cupe-pilot-readiness.yml`| LIVE (CI)    |
| Operational cadence review     | Console `/weekly-review`            | TBD (no E2E spec)        | GAP           |

---

## 3. Coverage Across Tiers

| Tier      | E2E execution         | Verdict |
|-----------|-----------------------|---------|
| local     | `pnpm -C apps/union-eyes e2e` (manual) | LIVE |
| dev       | n/a (no dev tier)     | DEFERRED |
| staging   | E2E workflow on push to `main` (`.github/workflows/e2e.yml`) | LIVE (post pool-fix) |
| demo      | Demo persona via staging fixtures | LIVE |
| pilot     | `cupe-pilot-readiness.yml` evidence pipeline | LIVE |
| prod      | Smoke probes only (no persona-based E2E in prod) | DEFERRED |

---

## 4. Required Expansion (gap closure backlog)

To meet "full operational realism journeys" criterion, the following E2E specs
are required. **None are in this PR; they are catalogued here as the canonical
backlog.**

| New spec required                                                | Owner             | Priority |
|------------------------------------------------------------------|-------------------|----------|
| `apps/console/tests/e2e/executive-review.spec.ts`                | console-engineering | High   |
| `apps/console/tests/e2e/operational-cadence-weekly-review.spec.ts` | console-engineering | High |
| `apps/zonga/tests/e2e/payouts-execution.spec.ts`                 | zonga-engineering | High     |
| `apps/zonga/tests/e2e/creator-onboarding.spec.ts`                | zonga-engineering | Medium   |
| `apps/union-eyes/tests/e2e/rollback-review.spec.ts`              | platform-admin    | Medium   |
| `apps/union-eyes/tests/e2e/restoration-review.spec.ts`           | platform-admin    | Medium   |
| `apps/cfo/tests/e2e/advisory-review.spec.ts`                     | cfo-engineering   | Medium   |

---

## 5. Recently Resolved E2E Issues

The following blockers are FIXED in this audit cycle:

| Issue                                                | Fix                                            | Commit         |
|------------------------------------------------------|------------------------------------------------|----------------|
| Playwright "The operation was canceled" mass cancellation | Connection-pool exhaustion mitigated:<br>- `db.ts` reduced CI pool 20→5, idle timeout 30→5s<br>- `cleanupDatabaseConnections()` helper + `test.afterEach()` in 10 spec files<br>- E2E job timeout 20→30 min | `3cab20a62` |
| QA baseline SQL incomplete (missing `users.avatar_url` and 18 other cols) | Complete schema restored to `tooling/sql/union-eyes-qa-baseline.sql` | `c285e5e52` |
| `ai-feature-guard` test asserting on legacy "AI" framing | Assertion updated to expect doctrine-aligned disclaimer | `767cbd684` |
| pnpm install ENOENT race in CI                       | Retry logic + `cache: pnpm` removed from setup-node | `0a3aeda5d` + `8b31057b9` |

---

## 6. E2E Workflow Health (`.github/workflows/e2e.yml`)

| Attribute               | Value                                                |
|-------------------------|------------------------------------------------------|
| Runner                  | `ubuntu-latest`                                      |
| Job timeout             | 30 minutes (post-fix)                                |
| Workers                 | 1 (sequential)                                       |
| Retries                 | 2 (in CI)                                            |
| Per-test timeout        | 60s                                                  |
| Navigation timeout      | 45s                                                  |
| Action timeout          | 20s                                                  |
| DB                      | Postgres 16 in Docker container (per matrix run)     |
| Bootstrap               | `db:migrate` + `seed:test-env` (UE matrix only)      |
| Server start            | `node .next/standalone/.../server.js` + curl healthcheck |
| Failure artifacts       | `playwright-report-*` + `app-server-log-*`           |

---

## 7. Findings

| Finding                                              | Severity | Mitigation                          |
|------------------------------------------------------|----------|-------------------------------------|
| No Zonga Playwright suite                            | High     | Backlog §4                          |
| No Console executive/cadence E2E                     | High     | Backlog §4                          |
| Rollback/restoration not automated                   | Medium   | Documented runbooks; periodic dry-runs |
| `ue-workflow.spec.ts` is `testIgnore`'d              | Low      | Re-enable after sub-suite stability validated |
| Prod tier has no persona-based E2E                   | Medium   | Smoke-only is appropriate for shared-fabric prod |

---

**Verdict for §6:** UE E2E coverage is **comprehensive and currently green**.
Cross-app E2E coverage is **PARTIAL** — Zonga and Console executive/cadence
journeys are the most material gaps and are tracked in the backlog above.
