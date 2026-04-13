# Compliance Certification Roadmap

**Document ID:** CR-2026-001  
**Version:** 1.0  
**Classification:** INTERNAL  
**Created:** 2026-04-12  
**Owner:** CISO  
**Status:** ACTIVE  

---

## 1. Objective

Achieve formal compliance certifications to demonstrate Nzila OS meets
industry-standard security, availability, and processing integrity
requirements. This roadmap sequences the certification journey based on
current readiness and business priorities.

---

## 2. Target Certifications

| Certification | Priority | Target Date | Business Driver |
|---------------|----------|-------------|-----------------|
| **SOC 2 Type I** | **Critical** | Q3 2026 | Enterprise customer requirement; validates control design |
| **SOC 2 Type II** | **Critical** | Q1 2027 | Validates controls operated effectively over 6+ months |
| **ISO 27001:2022** | **High** | Q2 2027 | International markets (Africa, EU); regulatory requirement |
| **GDPR Compliance Attestation** | **High** | Q3 2026 | EU partner operations; data subject rights |
| **POPIA Compliance** | **Medium** | Q4 2026 | South African market entry |

---

## 3. Current Readiness Assessment

Based on the self-assessment in `AUDIT_READINESS.md`:

| Framework | Controls Assessed | Implemented | Partial | Gap | Readiness |
|-----------|-------------------|-------------|---------|-----|-----------|
| SOC 2 Type II | 42 TSC | 40 | 2 | 0 | **95%** |
| ISO 27001 Annex A | 24 controls | 22 | 2 | 0 | **92%** |

### Automation Coverage
- **13/13** evidence collection processes are automated or semi-automated
- **10/10** control tests have defined schedules and owners
- **Daily** compliance evidence collection via `compliance.yml`
- **Weekly** vulnerability scanning + AI governance audit

---

## 4. Phase 1: SOC 2 Type I (Q2–Q3 2026)

### 4.1 Pre-Audit Preparation

| # | Task | Owner | Deadline | Status |
|---|------|-------|----------|--------|
| 1 | Select SOC 2 audit firm (CPA with AICPA accreditation) | CISO | May 2026 | 🔲 Not Started |
| 2 | Engage firm; sign Statement of Work | CISO | May 2026 | 🔲 Not Started |
| 3 | Conduct internal readiness review with audit firm | Security Lead | June 2026 | 🔲 Not Started |
| 4 | Complete third-party penetration test | Security Lead | June 2026 | 🔲 Not Started |
| 5 | Remediate pen test critical/high findings | Platform Eng | July 2026 | 🔲 Not Started |
| 6 | Generate evidence pack for all 28 controls | Platform Eng | July 2026 | 🔲 Not Started |
| 7 | Run compliance scorecard; verify all controls green | Security Lead | July 2026 | 🔲 Not Started |

### 4.2 Type I Audit (August 2026)

| # | Activity | Duration | Deliverable |
|---|----------|----------|-------------|
| 1 | Auditor document review | 1 week | Information request list (IRL) |
| 2 | Control design walkthroughs | 2 weeks | Developer interviews + demo sessions |
| 3 | Evidence sampling | 1 week | Auditor selects + validates artifacts |
| 4 | Draft report review | 1 week | Management response to findings |
| 5 | Final SOC 2 Type I report | — | Restricted-use or general-use report |

### 4.3 Key Documents for Auditor

| Document | Location |
|----------|----------|
| System description | `ARCHITECTURE.md` |
| Security policy | `SECURITY.md` |
| Threat model | `governance/security/THREAT_MODEL.md` |
| Evidence map | `ops/compliance/Required-Evidence-Map.md` |
| Control test plan | `ops/compliance/Control-Test-Plan.md` |
| Self-assessment | `governance/security/AUDIT_READINESS.md` |
| Pen test scope | `governance/security/PENTEST_SCOPE.md` |
| SBOM | `ops/security/sbom.json` |
| Build attestation | `ops/security/build-attestation.json` |

---

## 5. Phase 2: SOC 2 Type II (Q3 2026 – Q1 2027)

### 5.1 Observation Period

The Type II audit requires demonstrating controls operated effectively over
a minimum 6-month observation period.

| Activity | Timeline | Owner |
|----------|----------|-------|
| Begin observation period | August 2026 (post Type I) | CISO |
| Monthly control test execution | Monthly | Platform Eng |
| Quarterly DR restore test (CT-01) | Oct 2026, Jan 2027 | Platform Eng |
| Quarterly access review (CT-02) | Oct 2026, Jan 2027 | CISO |
| Continuous evidence collection | Daily (`compliance.yml`) | Automated |
| End observation period | February 2027 | CISO |

### 5.2 Type II Audit (March 2027)

| # | Activity | Duration |
|---|----------|----------|
| 1 | Auditor reviews 6-month evidence trail | 2 weeks |
| 2 | Control operating effectiveness testing | 2 weeks |
| 3 | Exception investigation (if any) | 1 week |
| 4 | Management response | 1 week |
| 5 | Final SOC 2 Type II report issued | — |

---

## 6. Phase 3: ISO 27001:2022 (Q1–Q2 2027)

### 6.1 Prerequisites
- SOC 2 Type I report (leverages same controls)
- Formal Information Security Management System (ISMS) documentation
- Management commitment statement

### 6.2 Gap Closure (Q1 2027)

| # | ISO Gap | Action | Owner | Deadline |
|---|---------|--------|-------|----------|
| 1 | A.6.1 Personnel screening | Formalize background check process with HR | CISO | Jan 2027 |
| 2 | A.8.20 mTLS (S-03) | Deploy Azure-native mTLS between Container Apps | Platform Eng | Q3 2026 |
| 3 | ISMS manual | Create formal ISMS scope document, risk register, Statement of Applicability | CISO | Feb 2027 |

### 6.3 Certification Audit

| Stage | Activity | Duration |
|-------|----------|----------|
| Stage 1 | Documentation review; ISMS scope verification | 2 days on-site/remote |
| Stage 2 | Control effectiveness audit; evidence sampling; interviews | 4–5 days |
| Report | ISO 27001:2022 certificate issued | 4–6 weeks post-audit |

---

## 7. Phase 4: GDPR & POPIA Compliance (Q3–Q4 2026)

### 7.1 GDPR Readiness

| # | Requirement | Nzila Implementation | Status |
|---|-------------|----------------------|--------|
| 1 | Lawful basis for processing | Consent + legitimate interest documented per data flow | 🔲 Document |
| 2 | Data Protection Impact Assessment (DPIA) | Threat model covers data flows; formalize as DPIA | 🔲 Formalize |
| 3 | Data subject rights (access, erasure, portability) | Entity-scoped data isolation; export capability; soft-delete | ⚠️ Partial |
| 4 | Data Processing Agreements (DPAs) | Azure DPA in place; Stripe DPA in place | ✅ Done |
| 5 | Data breach notification (72 hours) | IR runbook includes notification; Sentinel alerts | ✅ Done |
| 6 | Privacy by design | Data classification OPA policy; three-tier redaction; RLS | ✅ Done |
| 7 | Data Protection Officer designation | Appoint formal DPO | 🔲 Appoint |
| 8 | Record of processing activities (ROPA) | Derive from data classification policy + evidence map | 🔲 Create |

### 7.2 POPIA Readiness

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Registration with Information Regulator | 🔲 Submit |
| 2 | Information Officer appointed | 🔲 Appoint |
| 3 | Consent management | ⚠️ Extend platform auth consent model |
| 4 | Cross-border transfer safeguards | ✅ Azure Canada + standard contractual clauses |
| 5 | Security safeguards | ✅ Comprehensive (see self-assessment) |

---

## 8. Budget Estimates

| Engagement | Estimated Cost (USD) | Frequency |
|------------|---------------------|-----------|
| Third-party penetration test | $15,000 – $35,000 | Annual |
| SOC 2 Type I audit | $20,000 – $40,000 | One-time |
| SOC 2 Type II audit | $30,000 – $60,000 | Annual |
| ISO 27001 certification audit | $15,000 – $30,000 | Initial; surveillance annual |
| GDPR compliance review (legal) | $10,000 – $20,000 | One-time |
| POPIA registration and review | $5,000 – $10,000 | One-time |
| **Total Year 1** | **$95,000 – $195,000** | — |
| **Annual renewal** | **$45,000 – $90,000** | — |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| SOC 2 Type I report received | August 2026 | Report date |
| Zero critical pen test findings unresolved | July 2026 | Re-test attestation |
| SOC 2 Type II observation period started | August 2026 | Compliance log |
| SOC 2 Type II report received | March 2027 | Report date |
| ISO 27001 certificate received | June 2027 | Certificate date |
| GDPR DPIA completed | September 2026 | Document date |
| Control test pass rate | ≥ 95% | Monthly scorecard |
| Evidence automation coverage | 100% | Scorecard |

---

## 10. Risk to Certification Timeline

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pen test reveals critical finding | Delays Type I by 1–2 months | Strong existing controls reduce likelihood; rapid remediation SLAs |
| Audit firm availability | 1–2 month scheduling delay | Begin vendor selection May 2026 |
| Team bandwidth during audit | Developer time diverted to audit walkthroughs | Pre-generate all evidence; automate demonstrations |
| GDPR subject rights gaps | Partial implementation blocks attestation | Prioritize delete/export API in Q3 2026 |

---

## 11. Tracking

This roadmap is tracked in the compliance pipeline and reviewed monthly by
CISO and Platform Engineering. Updates are committed to this document with
review history below.

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-04-12 | Security Lead | Initial roadmap created |

---

## 12. Cross-References

| Document | Location |
|----------|----------|
| Pen Test Scope | `governance/security/PENTEST_SCOPE.md` |
| Audit Readiness Self-Assessment | `governance/security/AUDIT_READINESS.md` |
| STRIDE Threat Model | `governance/security/THREAT_MODEL.md` |
| Required Evidence Map | `ops/compliance/Required-Evidence-Map.md` |
| Control Test Plan | `ops/compliance/Control-Test-Plan.md` |
| Compliance Scorecard Generator | `tooling/security/compliance-scorecard.ts` |
| Evidence Storage Convention | `ops/compliance/Evidence-Storage-Convention.md` |
