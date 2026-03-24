# CUPE Pilot Go / No-Go Review

**Pilot Program:** CUPE Local 1234 Grievance Management (Union Eyes) v0.1  
**Review Date:** _____________________  
**Decision:** [ ] GO | [ ] NO-GO

---

## Executive Summary

Union Eyes is being prepared for CUPE Local 1234 pilot deployment, enabling a single local union (1–5 worksites, ~100–200 members) to manage grievance intake, triage, assignment, and closure with enterprise-grade auditing.

**Scope IN:**
- Grievance intake with taxonomy validation
- Triage + assignment workflow
- Case status tracking (filed → acknowledged → investigating → resolved/escalated/denied)
- Member + steward access roles (RLS enforced)
- Case timeline + audit trail with cryptographic sealing
- Evidence export for legal defensibility
- Leadership dashboard with reporting
- Admin console for org setup + user management
- Secure attachment handling with malware scanning
- Structured observability + correlation IDs

**Scope OUT (post-pilot):**
- Multi-CUPE-local federation
- Per-org taxonomy customization
- Advanced analytics (composition trends, disparity analysis)
- Mobile app or offline-capable workbench
- CUPE education platform integration
- White-label or multi-brand support

---

## Readiness Assessments

### 1. Functional Completeness

| Component | Status | Notes |
|-----------|--------|-------|
| **Intake Form** | ⬜ TBD | Vocabulary validation, clear errors, audit trail (PR-020) |
| **Triage/Assignment** | ⬜ TBD | Workbench with queues (PR-021) |
| **Case Workflow (FSM)** | ⬜ TBD | Server-side enforcement, UI reflects allowed transitions (PR-022) |
| **Case Timeline** | ⬜ TBD | All mutations logged, timeline UI shows chronological history (PR-031) |
| **Evidence Export** | ⬜ TBD | JSON export with cryptographic seal, verifiable for legal hold (PR-032) |
| **Reporting** | ⬜ TBD | Leadership dashboard + CSV export (PR-050–051) |
| **Admin Console** | ⬜ TBD | User management, worksite setup, SLA review (PR-060) |
| **Attachments** | ⬜ TBD | Scoped storage, signed URLs, malware scanning (PR-040–042) |
| **Audit Trail** | ⬜ TBD | All critical mutations logged, hash-chained, immutable (PR-030) |

### 2. Security & Compliance

| Aspect | Status | Verification Method |
|--------|--------|--------------|
| **Org Isolation** | ⬜ TBD | RLS policies enforce org_id bounds; contract tests pass (INV-31) |
| **RBAC Enforcement** | ⬜ TBD | 7 roles defined; action-denial tests pass; no escalation in logs |
| **Audit Completeness** | ⬜ TBD | All mutations logged; hash chain unbroken; evidence export verified |
| **Data Encryption** | ✅ In Place | TLS in transit; at-rest encryption via Azure defaults |
| **Malware Scanning** | ⬜ TBD | ClamAV integrated; clean/infected/unavailable states; boundary documented |
| **Secret Management** | ✅ In Place | Clerk auth; Azure Blob SAS tokens; no hardcoded secrets in git |

### 3. Operational Readiness

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Monitoring** | ⬜ TBD | Structured logs + correlation IDs; dashboards + alerts (PR-070) |
| **Incident SOP** | ⬜ TBD | `docs/CUPE_PILOT_SUPPORT_SOP.md` completed (PR-062) |
| **Admin Runbook** | ⬜ TBD | `docs/CUPE_PILOT_ADMIN_RUNBOOK.md` completed (PR-062) |
| **Support Team** | ⬜ TBD | Team reviewed runbooks; understood escalation criteria |
| **Rollback Capability** | ⬜ TBD | Can pause new cases, preserve all data, export evidence pack (PR-072) |
| **Deployment Plan** | ⬜ TBD | `docs/CUPE_PILOT_RELEASE_RUNBOOK.md` completed (PR-062) |

### 4. Known Limitations & Mitigations

| Limitation | Impact | Mitigation | Acceptance |
|-----------|---------|-----------|-----------|
| **ClamAV availability** | High | Graceful degradation; scan_status=unavailable; network monitoring | ⬜ TBD |
| **Dashboard 5-min cache** | Low | User can click "Refresh" for live data; acceptable lag | ⬜ TBD |
| **No bulk user import** | Low | Manual invite via admin form; acceptable for ~10 pilot users | ⬜ TBD |
| **Fixed SLA thresholds** | Medium | System defaults per workflow stage; per-case overrides post-pilot | ⬜ TBD |
| **Max 50 attachments/case** | Low | Design constraint; unlikely to affect pilot | ⬜ TBD |

### 5. CI/CD & Quality Gates

| Gate | Status | Verification |
|------|--------|----------|
| **RLS Enforcement** | ⬜ TBD | Contract test `ue-no-raw-db` + `ue-rls-org-context` passing |
| **RBAC Denial Tests** | ⬜ TBD | 2+ negative tests per action-role; no authorization bypass |
| **FSM Server Enforcement** | ⬜ TBD | All transitions validated; UI hides invalid actions (PR-022) |
| **Audit Hash Chain** | ⬜ TBD | Chain unbroken; evidence export verification succeeds |
| **Evidence Export** | ⬜ TBD | JSON schema valid, seal verifiable, case reconstruction possible |
| **Malware Scanning** | ⬜ TBD | ClamAV scanning tested or boundary control documented |
| **Security Scans (Trivy)** | ⬜ TBD | 0 CRITICAL vulns in apps/union-eyes Dockerfile |

### 6. Evidence of Readiness

- ⬜ **Codebase:** All 23 PRs merged to `release/cupe-pilot-0.1`
- ⬜ **Tests:** 7,669+ monorepo tests passing; 150+ contract tests passing
- ⬜ **Artifacts:** Evidence artifact generated + committed
- ⬜ **Documentation:** All runbooks, user guides, support SOP complete
- ⬜ **Walkthrough:** Pilot admin + steward workflows tested end-to-end
- ⬜ **Support:** Support team walked through SOP; ready to field issues

---

## Sign-Off

| Role | Name | Date | Notes |
|------|------|------|-------|
| **Platform Sponsor** | __________ | __________ | Sponsor confidence in pilot readiness & outcomes |
| **Pilot Lead** | __________ | __________ | CUPE local lead responsibility for go-live |
| **Support Manager** | __________ | __________ | Support team coverage during pilot |
| **Release Manager** | __________ | __________ | Deployment authority + rollback plan approval |

---

## Contingency Plan (If NO-GO)

If the **NO-GO** decision is made before go-live:

1. **Pause Deployment** (within 1 hour)
2. **Preserve Data** (export all cases + audit trail to evidence bundle)
3. **RCA** (document root cause + remediation plan)
4. **Reschedule** (reschedule go-live after remediation complete + re-validation passes)
5. **Communicate** (notify CUPE local of revised timeline + expected impact)

---

## Post-Launch Monitoring (First 2 Weeks)

| SLO | Target | Alert Threshold |
|-----|--------|---------|
| **Case Intake Success Rate** | ≥99% | Alert if < 99% (page dev team) |
| **Case Transition Success Rate** | ≥99% | Alert if < 99% (page dev team) |
| **Evidence Export Verification** | 100% | Alert if any export fails (manual review) |
| **Audit Trail Completeness** | 100% | Daily audit spot-check (hash chain integrity) |
| **Support Response Time** | ≤2 hours (business hrs) | Page on-call if > 4 hours |
| **System Uptime** | ≥99.5% | RCA + mitigation for any incident |

---

## Final Comments

*(To be filled by sponsors at sign-off)*

**Platform Sponsor:**
```
[Narrative confidence statement]
```

**Pilot Lead:**
```
[CUPE local readiness assessment]
```

**Support Manager:**
```
[Support team capacity + capability statement]
```

**Release Manager:**
```
[Deployment readiness + risk assessment]
```

---

**Decision:** [ ] GO | [ ] NO-GO

**Decision Authority:** _____________________________  
**Date:** _____________________________  
**Valid Until:** _____________________________ (recommended review at 2 weeks post-launch)

---

**Document Version:** 0.1-draft  
**Status:** TEMPLATE (to be filled during Phase 7 completion)  
**Next Review:** Post-PR-072 (final readiness seal)
