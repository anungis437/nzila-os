# CUPE Pilot Readiness Checklist — Phase Gates

**Status:** CUPE Local 1234 Pilot v0.1  
**Target Go-Live:** TBD  
**Last Updated:** 2026-03-24

---

## Phase 0 — Baseline Validation ✅ / 🔄 / ❌

**Gate Owner:** Platform Architect

- [ ] PR-000: Pilot CI gates + scaffolding merged
- [ ] PR-001: Current-state validation document complete
- [ ] Branch `release/cupe-pilot-0.1` created with protection rules
- [ ] All PRs (PR-010–PR-072) planned and PR descriptions drafted
- [ ] Evidence artifact generation tested
- [ ] Deferred items log initialized

**Status:** 🔄 IN PROGRESS (PR-000 being committed)

---

## Phase 1 — CUPE Domain Fit ✅ / 🔄 / ❌

**Gate Owner:** Product Lead

- [ ] PR-010: Vocabulary layer implemented (JSON-based config)
  - [ ] `packages/cupe-vocabulary/` created with loader
  - [ ] `getCUPEVocabulary()` export working
  - [ ] `/api/vocabulary` endpoint returns seeded terms
- [ ] PR-011: CUPE taxonomy pack seeded
  - [ ] `fixtures/cupe/taxonomy/` directory created
  - [ ] Admin form "Load pilot demo data" implemented
  - [ ] Taxonomy seeding idempotent
- [ ] PR-012: Union entity model validated + pilot seed data
  - [ ] Entity model audit complete
  - [ ] Pilot org + worksites + demo users created
  - [ ] Reset/reseed commands working
- [ ] Vocabulary API returns correct CUPE terms
- [ ] Admin form successfully creates pilot demo data

**Status:** 🔄 PLANNED (starting after PR-000 merged)

---

## Phase 2 — Core Workflow Hardening ✅ / 🔄 / ❌

**Gate Owner:** Development Lead

- [ ] PR-020: Intake hardening + validation + audit completion
  - [ ] Form validation (server-side + client-side)
  - [ ] Clear error messaging
  - [ ] Audit trail emits `CASE_INTAKE_SUBMITTED`
  - [ ] Hash chaining working
- [ ] PR-021: Assignment workbench polish
  - [ ] My Assigned section shows assigned cases
  - [ ] Unassigned queue visible to admin
  - [ ] Urgent section highlights with red badges
  - [ ] Overdue section shows SLA violations
  - [ ] Assign modal works + emits `CASE_ASSIGNED`
- [ ] PR-022: FSM enforcement + transition tests
  - [ ] Server rejects invalid transitions (403)
  - [ ] `GET /api/cases/{id}/next-actions` returns allowed actions
  - [ ] UI hides disallowed buttons
  - [ ] Transition audit entries created
  - [ ] Contract test `ue-fsm-server-enforced` passes
- [ ] PR-023: Case detail/history/notes UX
  - [ ] Case detail shows metadata + SLA deadline
  - [ ] Add note form works
  - [ ] Timeline shows all mutations in order
  - [ ] History/notes visible to org members only

**Status:** ⬜ NOT STARTED

---

## Phase 3 — Governance & Evidence Hardening ✅ / 🔄 / ❌

**Gate Owner:** Security Lead

- [ ] PR-030: Audited writes completion
  - [ ] All critical mutations wrapped in `auditedCaseMutation()`
  - [ ] Audit schema stores action, org, actor, old/new values
  - [ ] Hash chaining unbroken
- [ ] PR-031: Case timeline UI + audit viewer
  - [ ] Timeline component renders all audit entries
  - [ ] API `/api/cases/{id}/audit` returns entries with limit/offset
  - [ ] Correct timestamp ordering
- [ ] PR-032: Evidence export + seal verification
  - [ ] `GET /api/cases/{id}/export?format=json` returns complete export
  - [ ] Export includes case metadata + all audit entries + attachments manifest
  - [ ] Manifest hash verification works
  - [ ] Tampered export fails verification with specific error
  - [ ] Contract test `ue-evidence-export` passes
- [ ] PR-033: RBAC matrix + action-denial tests
  - [ ] `docs/CUPE_RBAC_MATRIX.md` complete
  - [ ] At least 2 negative tests per action-role pair
  - [ ] `canPerformAction()` function enforces all rules
  - [ ] No role escalation in logs
  - [ ] Contract test `ue-rbac-enforcement` passes

**Status:** ⬜ NOT STARTED

---

## Phase 4 — Attachment & Record Trust ✅ / 🔄 / ❌

**Gate Owner:** Security Lead

- [ ] PR-040: Scoped storage + signed access
  - [ ] Blob paths: `{orgId}/cases/{caseId}/attachments/{fileId}-{filename}`
  - [ ] File validation: whitelist types, max sizes
  - [ ] Signed URLs generated with 60-minute expiry
  - [ ] Audit: `ATTACHMENT_DOWNLOADED` emitted
  - [ ] RLS: User cannot download from other org
- [ ] PR-041: Attachment audit lifecycle + manifest
  - [ ] Audit events: UPLOADED, SCANNED, DOWNLOADED, DELETED
  - [ ] Manifest includes all attachments with hashes
  - [ ] Evidence export includes attachment manifest
  - [ ] Download count + last download tracked
- [ ] PR-042: Malware scanning boundary + ClamAV
  - [ ] ClamAV integration working (or graceful degradation documented)
  - [ ] Clean files pass, EICAR test file rejected
  - [ ] Scan status in attachment metadata (pending/clean/infected/unavailable)
  - [ ] Control boundary documented in `docs/CUPE_MALWARE_CONTROL_BOUNDARY.md`
  - [ ] Contract test `ue-malware-scanning` passes

**Status:** ⬜ NOT STARTED

---

## Phase 5 — Leadership Reporting & Workbench ✅ / 🔄 / ❌

**Gate Owner:** Product Lead

- [ ] PR-050: Leadership dashboard completion
  - [ ] KPI cards: total open, new this week, overdue ack, overdue resolution
  - [ ] Queue aging chart (0–7 days, 8–14, 15–30, 30+)
  - [ ] By category pie chart
  - [ ] By worksite + by assignee tables
  - [ ] Closure trends line chart (8 weeks)
  - [ ] Filters: timeframe, status, worksite
  - [ ] Caching: 5-minute TTL
- [ ] PR-051: Reporting exports (CSV)
  - [ ] `GET /api/reports/cases/export?format=csv`
  - [ ] Export modal in dashboard
  - [ ] Correct columns: caseNumber, created, status, assignee, worksite, type, priority, resolution_date, days_to_resolve
  - [ ] File naming: `union-eyes_cases_report_{date}.csv`
  - [ ] Audit: `REPORT_EXPORTED` emitted
- [ ] PR-052: Workbench UX polish
  - [ ] SLA deadline column with color indicators
  - [ ] Inline actions (quick acknowledge)
  - [ ] Better empty states ("All assigned! 🎉")

**Status:** ⬜ NOT STARTED

---

## Phase 6 — Admin & Onboarding ✅ / 🔄 / ❌

**Gate Owner:** Product Lead

- [ ] PR-060: Admin console completion
  - [ ] Settings page (read-only for pilot)
  - [ ] Users page: list, show roles, invite form
  - [ ] Taxonomy page (read-only, CUPE defaults)
  - [ ] Employers/Worksites: add new via form
  - [ ] SLA Thresholds: display defaults (read-only)
  - [ ] User invite sends email + logs audit entry
- [ ] PR-061: Setup checklist + onboarding UX
  - [ ] First-run checklist with interactive items
  - [ ] `docs/CUPE_PILOTING_QUICK_START.md` created (1–2 page guide)
  - [ ] All checklist items have "Learn more" links
- [ ] PR-062: Pilot documentation pack
  - [ ] `docs/CUPE_PILOT_ADMIN_RUNBOOK.md` — daily/weekly checks, troubleshooting
  - [ ] `docs/CUPE_PILOT_USER_GUIDE.md` — user quick-start
  - [ ] `docs/CUPE_PILOT_SUPPORT_SOP.md` — platform support playbook
  - [ ] `docs/CUPE_PILOT_ROLLBACK_RUNBOOK.md` — pause/recovery
  - [ ] `docs/CUPE_PILOT_RELEASE_RUNBOOK.md` — deployment steps

**Status:** ⬜ NOT STARTED

---

## Phase 7 — Pilot Readiness Seal ✅ / 🔄 / ❌

**Gate Owner:** Release Manager

- [ ] PR-070: Observability completion
  - [ ] Structured logging in all API routes
  - [ ] Correlation IDs propagate through request → DB → audit
  - [ ] @nzila/observability TraceContext integrated
  - [ ] W3C traceparent included in logs
- [ ] PR-071: CI readiness gates + evidence artifact
  - [ ] All contract tests passing (RLS, RBAC, FSM, audit, export, malware, security)
  - [ ] Evidence artifact generated on push to `release/cupe-pilot-0.1`
  - [ ] Artifact stored and indexed
- [ ] PR-072: Final checklist + go/no-go review
  - [ ] This checklist all items checked
  - [ ] `docs/CUPE_PILOT_GO_NO_GO_REVIEW.md` completed
  - [ ] `scripts/validate-cupe-pilot-readiness.sh` passes
  - [ ] Sponsor + pilot lead signed
  - [ ] Evidence artifact reviewed

**Status:** ⬜ NOT STARTED

---

## Pre-Go-Live Manual Validation

1. **Admin Setup Walkthrough** (30 min)
   - [ ] Pilot admin creates org
   - [ ] Invites steward + member
   - [ ] Adds worksite
   - [ ] Runs setup checklist
   - [ ] All steps complete without support

2. **Steward Case Workflow** (45 min)
   - [ ] Member files case via form
   - [ ] Steward receives & acknowledges
   - [ ] Steward assigns + adds note
   - [ ] Case transitions through workflow
   - [ ] Final closure + timeline visible
   - [ ] No errors in logs

3. **Dashboard & Export** (15 min)
   - [ ] Admin logs in, views dashboard
   - [ ] All metrics compute correctly
   - [ ] CSV export downloads with correct data
   - [ ] Report can be opened in Excel

4. **Support Readiness** (30 min)
   - [ ] Support team reviewed admin/user runbooks
   - [ ] Support team confirmed understanding of support SOP
   - [ ] Escalation criteria documented
   - [ ] Contact info + hours confirmed

5. **Sign-Off** (5 min)
   - [ ] Platform sponsor: "Ready" ✅
   - [ ] Pilot lead: "Ready to operate" ✅
   - [ ] Support manager: "Can support" ✅
   - [ ] Release manager: "Can deploy" ✅

---

## Go / No-Go Decision

**Release Gate:** All phases complete + all manual validation passed

| Item | Go | No-Go | Notes |
|------|----|----|-------|
| **Intake–Closure Flow** | [ ] | [ ] | |
| **Audit Completeness** | [ ] | [ ] | |
| **Org Isolation** | [ ] | [ ] | |
| **Evidence Trustworthy** | [ ] | [ ] | |
| **Operator Confidence** | [ ] | [ ] | |
| **Support Ready** | [ ] | [ ] | |
| **No Critical Defects** | [ ] | [ ] | |

**Final Decision:** [ ] GO | [ ] NO-GO

**Date:** _______________  
**Approved By:** _______________  
**Witness:** _______________

---

**Last Updated:** 2026-03-24  
**Review Frequency:** After each phase completion
