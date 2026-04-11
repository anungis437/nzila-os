# UnionEyes Current State Validation (Baseline for CUPE Pilot)

**Date:** 2026-03-24  
**Scope:** Single-local CUPE pilot (1–5 worksites, ~100–200 members)  
**Review Owner:** Platform Architect  
**Status:** BASELINE SNAPSHOT (updated after each phase)

---

## Executive Summary

UnionEyes has **70% readiness** for CUPE pilot launch. Core infrastructure exists (auth, case model, RLS, audit schema). Key gaps (FSM enforcement, evidence export, ClamAV, observable ops) require targeted build-out across phases 2–7.

---

## Detailed Readiness Assessment

### 1. **Authentication & Authorization** ✅ Ready

| Feature | Status | File Path | Notes |
|---------|--------|-----------|-------|
| **Clerk Integration** | ✅ Complete | `middleware.ts` | OAuth 2.0, satellite mode enabled |
| **Role Model** | ✅ Complete | `types/action-dtos.ts` | 7 roles: member, steward, officer, admin, chief_steward, business_agent, local_president |
| **Org Context** | ✅ Complete | `lib/organization-middleware.ts` | Middleware ensures org_id in request context |
| **RLS Policies** | ✅ Complete | `db/migrations/0001_nzilaos_rls_org_isolation.sql` | 238 RLS policies enforced per org |
| **withRLSContext** | ✅ Complete | `lib/db/with-rls-context.ts` | Sets org_id + user_id for all DB queries |

**Pilot Fit:** ✅ Ready. Org isolation + RBAC enforced at db + app layer.  
**Effort:** 0 days (reuse as-is)

---

### 2. **Case Management Model** ✅ Ready

| Entity | Status | File Path | Fields | Notes |
|--------|--------|-----------|--------|-------|
| **Case (Claim)** | ✅ Complete | `db/schema/claims-schema.ts` | claimId, claimNumber, memberId, orgId, caseType, priority, assignedTo, status | 18+ case types supported |
| **Grievance** | ✅ Complete | `db/schema/grievance-schema.ts` | grievanceId, staged workflow tracking, settlement terms | Formal grievance filing |
| **Case Updates** | ✅ Complete | `claimUpdates` table | updateType, isInternal, visibilityScope | supports member vs. staff visibility |
| **Assignments** | ✅ Complete | `grievance-workflow-schema.ts` | assigned_to, assignedAt, assignment role | basic; needs workbench UX |

**Pilot Fit:** ✅ Ready. Model supports intake → triage → assignment → closure with internal/external visibility.  
**Gap:** Case number format needs seeding.  
**Effort:** 0.5 days (add case number format + seeding logic)

---

### 3. **Workflow & State Machine** ⚠️ Partial

| Aspect | Status | File Path | Details |
|--------|--------|-----------|---------|
| **Case State Enum** | ✅ Complete | `claims-schema.ts` | 8 states: submitted, under_review, assigned, pending, resolved, rejected, closed |
| **Grievance FSM** | ✅ Complete | `grievance-schema.ts` | 13 states: filed, intake, investigation, step_1, step_2, step_3, mediation, pre_arbitration, arbitration, resolved, withdrawn, denied, settled |
| **Workflow Stages** | ✅ Defined | `grievance-workflow-schema.ts` | fromStage, toStage, conditions (JSONB), actions (JSONB), sla_days per stage |
| **Transition Rules** | ❌ Missing | — | No server-side validation of allowed transitions |
| **SLA Enforcement** | ⚠️ Partial | — | SLA days stored; deadline calculation OK; overdue detection missing |
| **Case Reopen** | ❌ Missing | — | No reverse transitions (closed → reopened) |

**Pilot Fit:** ⚠️ Partial. FSM transitions defined but **not server-enforced**.  
**Gaps to Fill:** 
- PR-022: Server-side FSM enforcement
- PR-023: Case detail shows SLA deadline; hide invalid action buttons

**Effort:** 3 days (PR-022 + PR-023)

---

### 4. **Audit & Logging** ⚠️ Partial

| Feature | Status | File Path | Details |
|---------|--------|-----------|---------|
| **Audit Schema** | ✅ Complete | `db/schema/audit-security-schema.ts` | Complete schema: tables for logs, events, failed logins, rate limits |
| **Audit Logging** | ⚠️ Partial | `lib/audit-logger.ts` | `auditDataMutation()` captures before/after; integration incomplete |
| **CAPE Events** | ✅ Partial | `lib/audit/cape-audit-events.ts` | Events defined: GRIEVANCE_SUBMITTED, ESCALATED, CLAIM_FILED |
| **Hash Chaining** | ❌ Missing | — | No cryptographic hash chain; @nzila/audit not integrated |
| **Correlation IDs** | ⚠️ Partial | `lib/api-guards.ts` | Request context propagation exists; use in all logs incomplete |
| **Case Timeline UI** | ❌ Missing | — | No UI for browsing audit trail per case |

**Pilot Fit:** ⚠️ Partial. Audit schema ready, but hash-chaining + verification missing.  
**Gaps to Fill:**
- PR-030: Wrap mutations with `auditedCaseMutation()` + hash chaining
- PR-031: Build case-timeline component + audit viewer API
- PR-070: Structured logging + correlation ID propagation

**Effort:** 6 days (PR-030 + PR-031 + PR-070)

---

### 5. **Attachments & File Handling** ⚠️ Partial

| Feature | Status | File Path | Details |
|---------|--------|-----------|---------|
| **File Storage** | ✅ Complete | `lib/document-management-system.ts` | Azure Blob + AWS S3 support; versioning, metadata |
| **Upload API** | ✅ Complete | `app/api/documents/` | Upload, categories, folders routes |
| **OCR Support** | ✅ Complete | DMS system | Image + PDF text extraction |
| **Access Levels** | ✅ Complete | DMS system | public, standard, confidential, restricted |
| **Malware Scanning** | ❌ Missing | — | No ClamAV integration |
| **Signed URLs** | ⚠️ Partial | `blob-client.ts` | Exists; not wrapped in org-scoped API route |
| **Manifest Support** | ❌ Missing | — | No attachment manifest in evidence export |

**Pilot Fit:** ⚠️ Partial. Storage ready; malware scanning + export manifest needed.  
**Gaps to Fill:**
- PR-040: Signed URL API route + org isolation RLS check
- PR-042: ClamAV integration
- PR-041: Attachment manifest in evidence export

**Effort:** 5 days (PR-040 + PR-041 + PR-042)

---

### 6. **Dashboards & Reporting** ⚠️ Partial

| Feature | Status | File Path | Details |
|---------|--------|-----------|---------|
| **Main Dashboard** | ✅ Complete | `app/dashboard/page.tsx` | Stats cards, recent activity feed |
| **Leadership Dashboard** | ⚠️ Partial | `app/dashboard/leadership/page.tsx` | KPIs, trends — **but metrics computation incomplete** |
| **Filters** | ❌ Missing | — | No stable timeframe, status, worksite filters |
| **CSV Export** | ❌ Missing | — | No export endpoint |
| **Case Queue UI** | ⚠️ Partial | `app/dashboard/` | No dedicated workbench (my assigned, unassigned, urgent, overdue) |
| **Case Detail View** | ⚠️ Partial | — | Exists; missing timeline, SLA deadline, notes section |

**Pilot Fit:** ⚠️ Partial. Dashboard structure exists; metrics + filtering + workbench need hardening.  
**Gaps to Fill:**
- PR-021: Case workbench with queues
- PR-023: Case detail with SLA + notes + timeline
- PR-050: Leadership dashboard completion (filters, caching)
- PR-051: CSV export

**Effort:** 7 days (PR-021 + PR-023 + PR-050 + PR-051)

---

### 7. **Evidence & Export** ❌ Missing

| Feature | Status | Details |
|---------|--------|---------|
| **Evidence Schema** | ❌ Missing | No canonical structure for case evidence bundle |
| **Export API** | ❌ Missing | No `/api/cases/{id}/export` endpoint |
| **Seal Verification** | ❌ Missing | No `verifyCaseEvidence()` function |
| **Manifest Format** | ❌ Missing | No attachment + audit manifest standard |
| **CI Gate** | ❌ Missing | No export test in contract tests |

**Pilot Fit:** ❌ Critical Gap. Evidence export required for legal defensibility.  
**Gaps to Fill:**
- PR-032: Build evidence exporter + seal verification
- PR-041: Attachment manifest support
- PR-071: Add evidence export test to CI

**Effort:** 4 days (PR-032 + PR-041 + PR-071)

---

### 8. **Admin Console** ⚠️ Partial

| Feature | Status | File Path | Details |
|---------|--------|-----------|---------|
| **Admin Pages** | ⚠️ Partial | `app/admin/` | Dashboard exists; needs: users, taxonomy, worksites, settings, SLAs |
| **User Management** | ❌ Missing | — | No invite UI (Clerk role mgmt externalized) |
| **Taxonomy Config** | ❌ Missing | — | No UI for taxonomy |
| **Worksite Management** | ❌ Missing | — | No CRUD for employers/worksites |
| **Setup Checklist** | ❌ Missing | — | No first-run wizard |

**Pilot Fit:** ⚠️ Partial. Admin shell exists; config surfaces missing.  
**Gaps to Fill:**
- PR-010–011: Vocabulary + taxonomy layer
- PR-060: Admin console completions
- PR-061: Setup checklist + first-run UX

**Effort:** 6 days (PR-010 + PR-011 + PR-060 + PR-061)

---

### 9. **Testing** ✅ Mostly Ready

| Category | Status | Details |
|----------|--------|---------|
| **Unit Tests** | ✅ Complete | Vitest config + 150+ tests |
| **E2E Tests** | ✅ Complete | Playwright 16 tests covering smoke + dashboard + cape flows |
| **Contract Tests** | ✅ Complete | 150+ tests; 9 UE-specific |
| **Python Tests** | ✅ Complete | Django tests for content, unions, claims |
| **New Tests (Pilot)** | ❌ Missing | FSM enforcement, RBAC denial, evidence export, malware scanning |

**Pilot Fit:** ✅ Ready. Infrastructure exists; pilot-specific tests need addition.  
**Effort:** 3 days (tests across PR-022, PR-032, PR-042, PR-071)

---

### 10. **Observability & Operations** ⚠️ Partial

| Feature | Status | Details |
|---------|--------|---------|
| **Structured Logging** | ⚠️ Partial | Logging exists; not structured format + correlation IDs incomplete |
| **Correlation IDs** | ⚠️ Partial | @nzila/observability available; not integrated to all layers |
| **Metrics/APM** | ✅ Partial | Instrumentation.ts exists; setup incomplete |
| **Healthcheck** | ✅ Partial | Exists; not all endpoints covered |
| **Runbooks** | ❌ Missing | No pilot-specific runbooks |

**Pilot Fit:** ⚠️ Partial. Infrastructure available; structured logs + ops docs missing.  
**Gaps to Fill:**
- PR-070: Structured loggers + correlation IDs across all routes + DB
- PR-062: Admin, support, release runbooks

**Effort:** 3 days (PR-070 + PR-062)

---

### 11. **CI/CD & Deployment** ✅ Ready

| Feature | Status | Details |
|---------|--------|---------|
| **CI Workflow** | ✅ Complete | ci.yml handles lint, typecheck, test, contract-tests |
| **Deploy Workflow** | ✅ Complete | deploy-union-eyes.yml handles staging + production |
| **Branch Protection** | ✅ Configurable | Can add to `release/cupe-pilot-0.1` |
| **Evidence Artifacts** | ✅ Partial | Scripts exist; pipeline integration TBD |

**Pilot Fit:** ✅ Ready. Ready with pilot-specific gates.  
**Effort:** 1 day (PR-000 — create `.github/workflows/cupe-pilot-readiness.yml`)

---

## Summary Table: Readiness by Feature

| Feature | Status | Effort | Owner | Target PR(s) |
|---------|--------|--------|-------|-------|
| Auth/RBAC | ✅ Ready | 0 | — | — |
| Case Model | ✅ Ready | 0.5 | Dev | PR-012 |
| RLS Isolation | ✅ Ready | 0 | — | — |
| Workflow FSM | ⚠️ Partial | 3 | Dev | PR-022 + PR-023 |
| Assignment Workbench | ⚠️ Partial | 3 | Dev | PR-021 |
| Audit Logging | ⚠️ Partial | 6 | Dev | PR-030 + PR-031 + PR-070 |
| Case Timeline UI | ❌ Missing | 2 | Dev | PR-031 |
| Evidence Export | ❌ Missing | 4 | Dev | PR-032 |
| Malware Scanning | ❌ Missing | 2 | Dev | PR-042 |
| Scoped Storage | ⚠️ Partial | 2 | Dev | PR-040 + PR-041 |
| Leadership Dashboard | ⚠️ Partial | 3 | Dev | PR-050 |
| CSV Export | ❌ Missing | 1 | Dev | PR-051 |
| Admin Console | ⚠️ Partial | 4 | Dev | PR-060 |
| Setup Checklist | ❌ Missing | 2 | Dev | PR-061 |
| Vocabulary Layer | ❌ Missing | 2 | Dev | PR-010 |
| CUPE Taxonomy | ❌ Missing | 2 | Dev | PR-011 |
| Documentation | ❌ Missing | 2 | TechWriter | PR-062 |
| Observability | ⚠️ Partial | 2 | DevOps | PR-070 |
| CI Gates | ⚠️ Partial | 1 | DevOps | PR-071 |

**Total Estimated Effort:** ~40 person-days. Feasible in 2 weeks with 3–4 parallel contributors.

---

## Critical Path for 2-4 Week Pilot Launch

**Dependency chains (must complete in order):**

1. **Phase 0** (2 days) — PR-000 + PR-001 scaffolding
   - Unblocks: Everything downstream
2. **Phase 1** (4 days) — PR-010 + PR-011 + PR-012 vocabulary + seeding
   - Unblocks: Phase 2 intake validation (depends on case numbering, taxonomy)
3. **Phase 2** (5 days) — PR-020–023 workflow hardening
   - Unblocks: Phase 3 evidence (depends on audit completion)
4. **Phase 3** (3 days) — PR-030–033 governance + evidence
   - Unblocks: Phase 4 + 5 (evidence export required)
5. **Phase 4** (3 days) — PR-040–042 attachment security
   - Parallel with Phase 5
6. **Phase 5** (3 days) — PR-050–052 reporting + workbench
   - Parallel with Phase 4
7. **Phase 6** (3 days) — PR-060–062 admin + docs
   - Parallel with phases 4–5
8. **Phase 7** (2 days) — PR-070–072 observability + final gates
   - Final seal; blocks merge to main

**Total:** 25 days sequential; 12–14 days with parallelization.

---

## Assumptions & Decisions for Pilot Fit

1. **Vocabulary:** Hardcoded CUPE taxonomy (no per-org customization in v0.1)
2. **FSM:** Simple linear workflow (no complex branches or parallel stages)
3. **Malware Scanning:** ClamAV for file scanning; network isolation as compensating control
4. **Dashboard Cache:** 5-minute TTL (acceptable lag for pilot)
5. **Support:** Business hours 8am–6pm Eastern; on-call 24/7 for critical incidents
6. **RLS:** All queries must use `withRLSContext()`; enforced by contract test
7. **Evidence:** Sealing via @nzila/evidence; exportable JSON + ZIP
8. **Org Seeding:** Admin console forms (no bulk import scripts)
9. **Case Numbers:** Human-readable format TBD (e.g., CUPE-LOCAL-001-001)
10. **Django Backend:** Keep as-is; no modernization for pilot scope

---

## Known Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **FSM enforcement bugs** | Medium | High | Add 15+ transition tests; manual walkthrough before go-live |
| **Org isolation leak** | Low | Critical | Contract test catches raw queries; RLS audit on staging |
| **Evidence export corrupts** | Low | High | Export test in CI; manual verification of exported pack |
| **ClamAV unavailable** | Medium | Medium | Fail-open (scan_status=unavailable); compensating control documented |
| **Dashboard metrics wrong** | Medium | Medium | Metrics test against test fixtures; manual dashboard review |
| **Support team overwhelmed** | Low | Medium | Runbook-driven ops; escalation plan; on-call rotation |
| **Scope creep during build** | High | High | enforce PR descriptions tight; defer items to DEFERRED_ITEMS.md |

---

## Next Steps After Validation (PR-001)

1. **PR branches drafted** (PR-010–PR-072) with descriptions
2. **Work streams assigned** (Dev leads, DevOps, TechWriter)
3. **Daily standups** on critical path items (Phase 2–3)
4. **Weekly phase sign-offs** (checklist completion)
5. **Pre-go-live walkthrough** (admin + steward + support team)
6. **Sponsor approval** (readiness checklist sign-off)

---

## Success Criteria for Phase Completion

**Phase 0 Complete:** ✅ Both PR-000 + PR-001 merged; CI gates configured + passing

**Phase 1 Complete:** All vocabulary/taxonomy/seed code merged; admin form loading demo data successfully

**Phase 2 Complete:** FSM enforcement + workbench merged; FSM tests passing; intake form validated + audit trail working

**Phase 3 Complete:** Evidence export + seal verification merged; case timeline UI rendering; RBAC denial tests passing

**Phase 4 Complete:** ClamAV integration + scoped storage merged; attachment upload/download working; audit events recorded

**Phase 5 Complete:** Leadership dashboard + CSV export merged; all metrics computing correctly; filters working

**Phase 6 Complete:** Admin console + setup checklist merged; documentation pack complete

**Phase 7 Complete:** All CI gates passing; evidence artifact generated; sponsor sign-off obtained; ready for go-live

---

**Sign-Off:** Current-state validation complete. Pilot-fit assessment: **70% ready as-is; 100% achievable in 2–4 weeks with focused parallel delivery.**

**Validated By:** _____________________ **Date:** _________________

**Next Review:** Post-PR-012 (union entity model + seed data complete)
