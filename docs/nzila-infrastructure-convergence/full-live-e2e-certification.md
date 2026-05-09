# 08 — Full Live E2E Certification

**Authority:** Live URL probes (May 9, 2026) + Playwright spec inventory.

---

## 1. Live URL Health Probes (just executed)

| URL                                                                                              | HTTP |
|--------------------------------------------------------------------------------------------------|------|
| `https://app.unioneyes.app`                                                                      | 200  |
| `https://staging.unioneyes.app`                                                                  | 200  |
| `https://nzilaventures.com`                                                                      | 200  |
| `https://console.nzilaventures.com`                                                              | 200  |
| `https://nzila-os-union-eyes-demo.greenmoss-d27e0e19.canadacentral.azurecontainerapps.io`        | 200  |

All five canonical URLs respond LIVE.

---

## 2. E2E Spec Inventory (UE)

| Spec                                       | Journey                                  | Verdict |
|--------------------------------------------|------------------------------------------|---------|
| `auth-session-switch.spec.ts`              | Sequential login replaces session        | LIVE    |
| `member-intake.spec.ts`                    | Member files grievance                   | LIVE    |
| `steward-review.spec.ts`                   | Steward reviews grievance                | LIVE    |
| `admin-assignment.spec.ts`                 | Admin assigns; member denied             | LIVE    |
| `auditor-readonly.spec.ts`                 | Read-only auditor boundary               | LIVE    |
| `cross-org-block.spec.ts`                  | Cross-org access denied                  | LIVE    |
| `case-escalation.spec.ts`                  | Case escalation                          | LIVE    |
| `case-resolution.spec.ts`                  | Case reaches resolved/closed             | LIVE    |
| `external-ux-tester.spec.ts`               | Sandbox containment                      | LIVE    |
| `ue-workflow.spec.ts`                      | End-to-end full lifecycle                | `testIgnore`'d |

---

## 3. Required Operational Journeys vs Coverage

| Journey                        | Spec / source                           | Tier coverage      |
|--------------------------------|------------------------------------------|--------------------|
| Onboarding                     | `member-intake.spec.ts`                  | local + staging    |
| Auth                           | `auth-session-switch.spec.ts`            | local + staging    |
| Dashboard redirects            | covered in auth/role specs               | local + staging    |
| Governance review              | `auditor-readonly.spec.ts`               | local + staging    |
| Pilot flows                    | manual via pilot org tagging             | staging (logical)  |
| Grievance continuity           | `case-escalation` + `case-resolution`    | local + staging    |
| Operational cadence            | **NO E2E** — Console weekly review surface lacks spec | GAP    |
| Executive walkthrough          | **NO E2E**                               | GAP                |
| Procurement walkthrough        | `cupe-pilot-readiness.yml` evidence pipeline | CI            |
| Rollback                       | manual procedure (`az containerapp revision set-mode`) | DOCUMENTED, NOT AUTOMATED |
| Restoration                    | manual procedure (PG PITR)               | DOCUMENTED, NOT AUTOMATED |
| Role gating                    | covered in admin/auditor specs           | local + staging    |
| Insights navigation            | smoke (Console)                          | PARTIAL           |
| Trust-center flows             | smoke (web)                              | PARTIAL           |

---

## 4. Cross-tier E2E Execution Status

| Tier      | E2E run target                          | Verdict |
|-----------|------------------------------------------|---------|
| local     | local web server + local PG              | LIVE    |
| staging   | `.github/workflows/e2e.yml` against staging URLs (post pool-fix) | LIVE |
| demo      | NOT EXECUTED — demo lacks auth secrets   | BLOCKED |
| pilot     | `cupe-pilot-readiness.yml` evidence-only | PARTIAL |
| prod      | smoke probes only                        | PARTIAL |

---

## 5. Live URL Traversal — Required for full certification

The following live URL traversals are REQUIRED as part of full certification.
**Authorization required to execute as part of CI gate or as a one-shot.**

| Traversal                                  | Authorization |
|--------------------------------------------|---------------|
| Curl `/api/health` on every staging app   | LOW (read-only) |
| Sign in as each persona on staging         | YES (live persona traffic) |
| Cross-org block test on live staging       | YES |
| Demo URL UX-only walkthrough               | LOW (no auth) |
| Procurement evidence pack regeneration     | LOW (CI)      |

---

## 6. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| E1 | Add `apps/console/tests/e2e/executive-review.spec.ts`              | LOW (repo)    |
| E2 | Add `apps/console/tests/e2e/operational-cadence-weekly-review.spec.ts` | LOW       |
| E3 | Add `apps/zonga/tests/e2e/payouts-execution.spec.ts`               | LOW           |
| E4 | Add live-traversal job to E2E workflow against staging URLs         | YES           |
| E5 | After demo R3 (secrets wiring): add demo E2E run                    | YES           |
| E6 | Re-enable `ue-workflow.spec.ts` post-stability                      | LOW           |

---

## 7. Findings

| # | Finding                                                            | Severity |
|---|--------------------------------------------------------------------|----------|
| 1 | UE Playwright suite is comprehensive and currently green            | LIVE     |
| 2 | Console executive/cadence E2E missing                              | High     |
| 3 | Zonga has no Playwright suite                                      | High     |
| 4 | Demo cannot run E2E (no secrets)                                   | High     |
| 5 | No live-traversal job in CI                                        | Medium   |
| 6 | Rollback/restoration not automated                                 | Medium   |

---

**Verdict for §8:** Live E2E certification is **PARTIAL**. UE staging E2E is
LIVE. Demo E2E is BLOCKED until secrets are wired. Several material journeys
lack specs and are catalogued in §6.
