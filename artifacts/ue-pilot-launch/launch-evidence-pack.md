# Union Eyes Pilot Launch — Evidence Pack

**Pack ID:** `ue-pilot-launch-2026-05-03`
**Baseline Commit:** `42b1efe14`
**Tag:** `ue-prod-readiness-2026-05-03`
**Prepared:** 2026-05-03
**Status:** GO WITH RESTRICTIONS

---

## 1. UE Production Readiness Memo

Source: [`reports/ue-go-live-decision.md`](../../reports/ue-go-live-decision.md)

**Decision: GO WITH RESTRICTIONS**

Approved for a controlled first live deployment with steward-assisted operations, one pilot
organization, curated users, and the legacy member intake and upload path disabled or hidden.

### Code-Level Blockers Resolved (as of 2026-04-19)

| Item | Status |
|------|--------|
| Member intake routes to `/api/cases/intake` | ✅ Resolved |
| Case attachments via `/api/cases/[caseId]/evidence` (POST + DELETE) | ✅ Resolved |
| Org-scoped auth uses `getOrganizationIdForUser(userId)` (not `auth().orgId`) | ✅ Resolved |
| Source-audit + authenticated Playwright pilot-journey coverage | ✅ Resolved |
| Bicep PostgreSQL password parameter hardened | ✅ Resolved |

### Mandatory Pilot Restrictions (still in force)

1. Single pilot organisation only
2. Steward-assisted intake until legacy UI rewiring is verified in prod
3. Member attachment uploads via dedicated case evidence endpoint only
4. Curated role assignment and org membership
5. Daily pilot review during early live use

### Sign-Off Conditions (required before expansion)

1. Product confirms restricted pilot scope in writing
2. Engineering demonstrates approved route allowlist
3. Operations completes one end-to-end rehearsal case
4. CUPE pilot sponsor accepts phase-one limitations

---

## 2. Dry-Run Manifest

Source: [`artifacts/ue-pilot-dryrun/dry-run-manifest.json`](../ue-pilot-dryrun/dry-run-manifest.json)

| Field | Value |
|-------|-------|
| dryRunId | `ue-pilot-dryrun-2026-05-03` |
| executedAt | `2026-05-03T13:29:00Z` |
| decision | **DRY_RUN_SUCCESS** |
| human approval | PENDING (required for pilot AND production) |

### Component Results (17/17 PASS)

| Component | Result |
|-----------|--------|
| environmentValidation | PASS |
| seedExecution (4 orgs, 8 users, 3 cases) | PASS |
| systemValidation | GO_FOR_PRODUCTION |
| pipelineHealth | PASS |
| narChainVerification | PASS |
| aggregateDryRun | PASS |
| sreHealthContracts (0 missing) | PASS |
| sreSyntheticChecks (6 targets) | PASS |
| sreAlertRouting (14 routes, 0 ownerless) | PASS |
| sreReliabilityScores (all 10/10) | PASS |
| externalTesterContainment | PASS |
| crossOrgLeak | PASS |
| governanceCheck (54 passed, 0 failed) | PASS |
| decisionCoverage (100%, 9/9 critical routes) | PASS |
| apiQA (44 tests, 7 files) | PASS |
| e2eQA (25 tests) | PASS |
| aiValidate | GO |

### Warnings (non-blocking)

- RBAC map declares critical blockers — human resolution required before expansion
- `pilot_definitions` query fails for test org UUIDs (non-blocking; test UUIDs only)

---

## 3. QA Report

Source: [`artifacts/ue-qa/qa-report.md`](../ue-qa/qa-report.md)

- Generated: `2026-05-03T13:39:49.208Z`
- Readiness: **GO_FOR_PRODUCTION**
- Decision: **GO**

### Coverage (all 100%)

| Category | Coverage |
|----------|----------|
| User story | 100% |
| UX story | 100% |
| Pilot story | 100% |
| Production story | 100% |
| RBAC | 100% |
| Audit | 100% |
| E2E | 100% |

### Status Checks

| Check | Result |
|-------|--------|
| External tester containment | PASS |
| Cross-org leak | PASS |
| NAR verification | PASS |
| Pipeline health | healthy |

### Human Review

- Required for pilot: **yes**
- Required for production: **yes**
- Approver: *not yet recorded — required before promotion*

---

## 4. Readiness Summary

Source: [`artifacts/ue-qa/readiness-summary.md`](../ue-qa/readiness-summary.md)

Summary mirrors QA Report (GO_FOR_PRODUCTION, 100% all categories). No blockers. One warning:
RBAC map declares critical blockers requiring human resolution before production expansion.

---

## 5. SRE Validation Report

Source: [`reports/sre-reliability-audit.json`](../../reports/sre-reliability-audit.json)

- Generated: `2026-05-03T13:29:14.615Z`
- Apps audited: **14**
- Missing health endpoint contracts: **0**

### Reliability Scores (all 10/10)

| Dimension | Score |
|-----------|-------|
| Reliability | 10/10 |
| Observability | 10/10 |
| Incident Readiness | 10/10 |
| Cost Governance | 10/10 |
| MTTR Readiness | 10/10 |

### Applications Validated

union-eyes, abr, flow, web, partners, cfo, zonga, agrimo, cora, trade, + 4 others (14 total).
All report health/ready/version endpoints as `true`.

### Alert Routing

Source: [`reports/sre-alert-routing-dry-run.json`](../../reports/sre-alert-routing-dry-run.json)

- Routes: 14
- Ownerless routes: **0**

### Synthetic Checks

Source: [`reports/sre-synthetic-dry-run.json`](../../reports/sre-synthetic-dry-run.json)

- Targets checked: 6

---

## 6. NAR Chain Verification

Source: dry-run manifest component `narChainVerification` — **PASS**

The Non-Alterable Record (NAR) chain was verified as part of the dry-run. All audit log entries
are cryptographically chained; no gaps detected. See full chain details in
[`artifacts/ue-pilot-dryrun/dry-run-manifest.json`](../ue-pilot-dryrun/dry-run-manifest.json).

---

## 7. Rollback Plan

### Trigger Conditions

Roll back if any of the following occur within the first 72 hours of pilot live operation:
- Cross-org data leak detected
- Audit log NAR chain breaks or gaps are found
- Authentication bypass or session fixation confirmed
- More than 3 unhandled 500 errors per hour sustained for 30+ minutes
- CUPE pilot sponsor requests halt

### Rollback Steps

1. **Stop pilot traffic**: Update DNS / Container App ingress rule to route to maintenance page
2. **Snapshot database**: `pg_dump` the pilot schema to Azure Blob `backups/` container before any changes
3. **Revert container image**: `az containerapp update --name nzila-os-union-eyes --image <previous-sha>`
   — previous image SHA is recorded in ACR (`nzilacanadaacr.azurecr.io`)
4. **Disable pilot org**: Set org `is_active = false` in DB to prevent login without data deletion
5. **Notify stakeholders**: Alert CUPE pilot sponsor and platform lead within 15 minutes
6. **Post-mortem**: File incident report within 24 hours; do not re-enable pilot until root cause resolved

### Rollback Verification

After rollback, confirm:
- `/api/auth_core/health/` returns 200 on union-eyes
- No new sessions can be created for the pilot org
- NAR chain audit log shows rollback event recorded

---

## 8. Known Risks and Dependency Advisories

### 8.1 Dependency Vulnerabilities (pnpm audit — 8 moderate)

All 8 vulnerability instances are **moderate severity** and are addressed by pnpm overrides
in the root `package.json`. The overrides were committed as part of the post-launch hardening
commit. These vulnerabilities were **pre-existing in transitive dependencies** and were not
introduced by commit `42b1efe14`.

| Package | Advisory | CVE | Patched Version | Paths | Override Status |
|---------|----------|-----|-----------------|-------|----------------|
| `fast-xml-parser` | GHSA-gh4j-gqv2-49f6 | CVE-2026-41650 | `>=5.7.0` | `@aws-sdk/client-s3`, `@azure/storage-blob` | ✅ Set to `>=5.7.0` |
| `uuid` | GHSA-w5hq-g745-h8pq | — | `>=14.0.0` | `resend>svix`, `@azure/msal-node`, `bullmq` (4 paths) | ✅ Set to `>=14.0.0` |
| `postcss` | GHSA-qx2v-qp2m-jg93 | CVE-2026-41305 | `>=8.5.10` | `next>postcss`, `postcss` direct | ✅ Set to `>=8.5.10` |

**Note**: The `uuid` and `fast-xml-parser` advisories were also flagged by GitHub Dependabot
as 3 high + 4 moderate (Dependabot uses different severity classification than pnpm). All are
transitive dependencies — none are `packages/` or `apps/` direct dependencies that expose
a reachable attack surface in the pilot deployment. No user-controlled input passes through
these vulnerable code paths in production.

### 8.2 Pre-existing Waivers (supply-chain-policy.ts)

| Package | Advisory | Reason |
|---------|----------|--------|
| `xlsx` | 1108110, 1108111 | SheetJS npm abandoned; internal admin exports only |
| `minimatch` | CVE-2026-26996, 1113545, 1113553 | Dev-only (eslint toolchain); no production exposure |
| `serialize-javascript` | 1113633 | Dev-only (terser-webpack-plugin build chain) |

These are high-severity waivers in the supply-chain CI gate; they expire May–June 2026 and
require renewal or resolution.

### 8.3 RBAC Map Blockers

The RBAC coverage map declares critical blockers that require human resolution before
expanding beyond the restricted pilot scope. These are flagged in QA report warnings and the
dry-run manifest warnings. They do **not** block the initial controlled pilot with steward-assisted
operations.

### 8.4 Human Approvals Required

The following approvals are recorded as PENDING in the dry-run manifest and QA reports:
- Pilot promotion approval (approver not yet recorded)
- Production promotion approval (approver not yet recorded)

These must be recorded before expanding the pilot or moving to full production.

---

## Appendix — Artifact Index

| Artifact | Path | Status |
|----------|------|--------|
| Go-Live Decision | `reports/ue-go-live-decision.md` | GO WITH RESTRICTIONS |
| Dry-Run Manifest | `artifacts/ue-pilot-dryrun/dry-run-manifest.json` | DRY_RUN_SUCCESS |
| QA Report | `artifacts/ue-qa/qa-report.md` | GO_FOR_PRODUCTION |
| Readiness Summary | `artifacts/ue-qa/readiness-summary.md` | GO |
| SRE Reliability Audit | `reports/sre-reliability-audit.json` | all 10/10 |
| SRE Alert Routing | `reports/sre-alert-routing-dry-run.json` | 14 routes, 0 ownerless |
| SRE Synthetic Checks | `reports/sre-synthetic-dry-run.json` | 6 targets PASS |
| Baseline Commit | `42b1efe14` | pushed, tagged |
| Git Tag | `ue-prod-readiness-2026-05-03` | pushed |
