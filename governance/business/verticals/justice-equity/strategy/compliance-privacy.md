# Justice-Equity Vertical — Compliance & Privacy

**Last Updated: February 2026**
**Platform:** ABR Insights
**Jurisdiction:** Canada (primary), Ontario (Bill 67), Federal (CHRC)

---

## 1. Bill 67 Compliance (Ontario Anti-Racism Act)

### Overview

Bill 67 mandates anti-racism training for Ontario public sector employees. ABR Insights is purpose-built for compliance.

### Requirements & Platform Alignment

| Bill 67 Requirement | ABR Insights Implementation | Status |
|---------------------|---------------------------|--------|
| Mandatory anti-racism training for public sector employees | Core LMS with 10+ ABR courses, certificate tracking | Ready Q2 2026 |
| Training must address systemic anti-Black racism specifically | Dedicated ABR curriculum + 10,000+ tribunal cases | Ready |
| Completion tracking and reporting to ministry | Admin dashboard with compliance % and exportable reports | Ready Q2 2026 |
| Phased rollout (ministries → agencies → broader public sector) | Multi-tenant org hierarchy supporting phased deployment | Ready |
| Annual recertification requirement | Automated annual reassessment with certificate renewal | Q3 2026 |
| Accessible training (AODA intersection) | WCAG 2.1 AA compliant, screen reader support, captions | Ready |

### Phased Rollout Timeline (Ontario Public Sector)

| Phase | Timeline | Scope | ABR Insights Readiness |
|-------|----------|-------|----------------------|
| Phase 1 | H2 2026 | Core Ontario ministries (25+ ministries) | Platform launch Q2 2026 |
| Phase 2 | H1 2027 | Agencies, boards, commissions | Multi-tenant dashboards Q2 2027 |
| Phase 3 | H2 2027 | Broader public sector (hospitals, schools, municipalities) | Sector-specific courses Q3 2027 |
| Phase 4 | 2028 | Full compliance enforcement + audit | Compliance reporting v2 + audit trail |

### Compliance Reporting Features

- Real-time compliance dashboard showing % of employees trained per department
- Automated alerts for upcoming deadlines and overdue learners
- Audit-ready export: PDF/CSV compliance packages with timestamps and certificates
- Ministry-specific reporting templates aligned with Bill 67 submission requirements

---

## 2. AODA Compliance (Accessibility for Ontarians with Disabilities Act)

### Intersection with DEI Training

AODA requires organizations to provide accessible training materials. ABR Insights addresses both accessibility and DEI requirements simultaneously.

| AODA Standard | ABR Insights Compliance |
|---------------|------------------------|
| IASR (Integrated Accessibility Standards Reg.) | All course content meets WCAG 2.1 AA |
| Customer Service Standard | Learner support accessible via multiple channels |
| Information & Communications | Accessible documents, captioned video, screen reader support |
| Employment Standard | Training content addresses accessibility + anti-racism intersectionality |
| Design of Public Spaces | N/A (digital platform) |

### Technical Accessibility Implementation

| Feature | Standard | Implementation |
|---------|----------|---------------|
| Color Contrast | WCAG 2.1 AA (4.5:1) | Verified via axe-core in CI/CD pipeline |
| Keyboard Navigation | WCAG 2.1 AA | Full keyboard accessibility, visible focus |
| Screen Reader | WCAG 2.1 AA | Semantic HTML, ARIA labels, live regions |
| Closed Captions | WCAG 2.1 AA | 99%+ accuracy on all video content |
| Text Resize | WCAG 2.1 AA | Functional at 200% zoom |
| Reduced Motion | WCAG 2.1 AA | Respects `prefers-reduced-motion` OS setting |

---

## 3. CHRC Federal Mandate Alignment

### Federal Anti-Racism Framework

| Requirement | ABR Insights Alignment |
|-------------|----------------------|
| Employment Equity Act compliance training | Core ABR curriculum covers systemic racism in employment |
| Federal workplace anti-racism training | Ready for federal procurement (10+ relevant courses) |
| Annual reporting on diversity initiatives | Analytics dashboard generates diversity training metrics |
| Bilingual requirements (English + French) | French language support planned Q3 2027 |
| Federal procurement compliance (PSPC) | Working toward standing offer or supply arrangement |

### Federal Partnership Strategy

- Target CHRC endorsement as recommended ABR training platform
- Align with Treasury Board Secretariat anti-racism strategy
- Pursue PSPC standing offer for federal departments
- Ensure bilingual compliance by Q3 2027 for federal eligibility

---

## 4. ESG Reporting Integration

### TSX/NYSE Diversity Metrics

Public companies listed on TSX and NYSE face increasing ESG reporting requirements for diversity and inclusion metrics.

| ESG Framework | Relevant Metrics | ABR Insights Data |
|---------------|-----------------|-------------------|
| GRI (Global Reporting Initiative) | GRI 405: Diversity, GRI 406: Non-discrimination | Training completion rates, incident reduction |
| SASB | Social Capital — Employee Engagement | Learner engagement scores, completion % |
| TCFD (extended to social) | Workforce diversity programs | Program effectiveness metrics |
| TSX Diversity Disclosure | Board + workforce diversity training | Exportable compliance data per reporting period |
| S&P CSA (Corporate Sustainability Assessment) | DEI training programs | Completion rates, assessment scores |

### ESG Data Export Features

- Automated quarterly ESG data package (PDF + structured CSV)
- Pre-formatted for GRI, SASB, and TSX disclosure templates
- Metrics included: learners trained, completion rate, assessment scores, CE credits, re-certification rates
- Year-over-year trend analysis for continuous improvement evidence

---

## 5. PIPEDA Compliance (Privacy)

### Learner Data Processing

| Data Category | Purpose | Legal Basis | Retention |
|---------------|---------|-------------|-----------|
| Learner Identity (name, email) | Account creation, certificate generation | Consent (sign-up) | Account lifetime + 7 years |
| Course Progress | Learning tracking, gamification | Consent (platform usage) | Account lifetime + 7 years |
| Assessment Results | Certification, compliance reporting | Legitimate interest (employer mandate) | 7 years after completion |
| GPT-4 Interactions | AI coaching, personalization | Consent (feature opt-in) | 90 days (anonymized after) |
| Gamification Data (XP, badges) | Engagement, leaderboards | Consent (platform usage) | Account lifetime |
| Tribunal Search History | Personalization, analytics | Consent (feature usage) | 90 days |
| IP Address / Device Info | Security, fraud detection | Legitimate interest | 30 days |

### Privacy Principles Implementation

| PIPEDA Principle | Implementation |
|-----------------|---------------|
| Accountability | Designated Privacy Officer, documented policies |
| Identifying Purposes | Clear purpose stated at collection, consent banners |
| Consent | Explicit consent at sign-up, granular opt-ins for AI features |
| Limiting Collection | Data minimization — only collect what's necessary for stated purpose |
| Limiting Use/Disclosure | Data used only for stated purposes, no sale to third parties |
| Accuracy | Learner self-service profile editing, annual data review prompts |
| Safeguards | Encryption at rest (AES-256) and in transit (TLS 1.3), RBAC |
| Openness | Public privacy policy, data processing documentation available |
| Individual Access | Learner data export (GDPR-style), deletion request within 30 days |
| Challenging Compliance | Privacy complaint process documented, escalation path defined |

### Data Minimization for AI

- GPT-4 prompts stripped of PII before submission to Azure OpenAI
- No learner names or identifiers sent to AI models
- Conversation logs anonymized after 90 days
- Azure OpenAI data processing agreement: Microsoft does not use customer data for model training

---

## 6. CE Credit Regulatory Requirements

### CPHR Accreditation (28K+ Members)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Course content review by CPHR committee | In progress | Submit Q2 2026 |
| Learning objectives aligned to CPHR competency framework | Completed | Mapped to 4 CPHR domains |
| Assessment validates learning outcomes | Ready | 80% pass threshold, randomized question pools |
| Instructor/SME qualifications documented | Ready | DEI + legal SME credentials on file |
| CE credit hours accurately calculated | Ready | 1 CE credit per 60 min of validated learning |
| Annual renewal of accreditation | Planned | Annual review + new course submissions |

### OAHPP Requirements (6K+ Health Professionals)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Content relevance to health profession practice | In progress | Healthcare-specific ABR course module |
| Self-assessment component | Ready | Pre/post assessments with reflection prompts |
| Completion certificates with CE credit hours | Ready | Auto-generated PDF with QR verification |
| Record keeping (3 years minimum) | Ready | 7-year retention (exceeds requirement) |

### Law Society CPD (Future — Q3 2027)

| Requirement | Status | Notes |
|-------------|--------|-------|
| LSO-approved CPD provider application | Planned | Application Q2 2027 |
| Content relevant to legal practice (ABR in legal) | Planned | Legal profession ABR course module |
| 50/50 substantive/professionalism split | Planned | Course design to meet CPD categories |
| Attendance verification | Ready | Platform tracks exact time-on-content |

---

## 7. Content Compliance

### CanLII Terms of Service

| Requirement | Compliance Approach |
|-------------|-------------------|
| Attribution | All tribunal cases attributed to CanLII with case citation |
| Non-commercial redistribution limits | Cases displayed within platform context, not bulk downloadable |
| No modification of case text | Original text preserved, AI analysis clearly separated |
| Terms review | Annual legal review of CanLII ToS compliance |

### Legal Review Process for Tribunal Case Usage

1. **Automated Ingestion:** CanLII API → raw case text ingested weekly
2. **Legal Review:** Quarterly sample audit (5% of new cases) by legal counsel
3. **Content Flagging:** AI-assisted flagging of sensitive cases (minors, sexual assault, sealed records)
4. **Anonymization Check:** Verify case text respects publication bans and anonymization orders
5. **User Reporting:** Learners can flag potentially problematic case content → reviewed within 48 hours

### Course Content Review Process

| Review Stage | Reviewer | Cadence |
|-------------|----------|---------|
| SME Review | DEI subject matter expert | Every new course |
| Legal Review | Legal counsel | Every new course + quarterly audit |
| Sensitivity Review | Community advisory panel | Every new course |
| Accessibility Review | Accessibility specialist | Every new course |
| Annual Content Refresh | Content team + SME | All courses annually |

---

## 8. Data Retention Policies

| Data Type | Retention Period | Justification | Deletion Method |
|-----------|-----------------|---------------|-----------------|
| Learner profiles | Account lifetime + 7 years | Regulatory compliance, certificate verification | Automated purge, verified |
| Course completion records | 7 years after completion | Bill 67, AODA, employment law requirements | Automated purge |
| Certificates | Perpetual | Professional credential verification | Never deleted (anonymized after 10 years) |
| Assessment results | 7 years after completion | Compliance audit trail | Automated purge |
| GPT-4 conversation logs | 90 days | Debugging, quality improvement | Automated anonymization → deletion |
| Tribunal search history | 90 days | Personalization | Automated deletion |
| Audit logs (admin actions) | 7 years | SOC 2 compliance | Immutable log, automated archival |
| Payment records | 7 years | CRA tax requirements | Encrypted archival |

---

## 9. SOC 2 Audit Readiness

### SOC 2 Type II — Target: Q4 2027

| Trust Service Criteria | Current Status | Gap | Remediation Plan |
|----------------------|---------------|-----|-----------------|
| **Security** | Partial | Formal incident response plan needed | Document IRPlan Q3 2026 |
| **Availability** | Partial | SLA documentation needed | Define SLAs Q2 2026 |
| **Processing Integrity** | Partial | Data validation controls documentation | Document Q3 2026 |
| **Confidentiality** | Strong | Encryption + RBAC in place | Pen test Q4 2026 |
| **Privacy** | Strong | PIPEDA compliance framework | Privacy impact assessment Q2 2026 |

### SOC 2 Readiness Milestones

| Milestone | Target Date | Owner |
|-----------|------------|-------|
| Security policies documented | Q2 2026 | Engineering Lead |
| Incident response plan formalized | Q3 2026 | Security + Legal |
| Access control audit completed | Q3 2026 | Engineering Lead |
| Penetration test (third-party) | Q4 2026 | External vendor |
| SOC 2 Type I audit | Q2 2027 | External auditor |
| SOC 2 Type II audit (12-month) | Q4 2027 | External auditor |
| Annual SOC 2 renewal | Q4 2028+ | Ongoing |

### Key Controls

- **Access Management:** Clerk RBAC, MFA for admin roles, quarterly access reviews
- **Change Management:** GitHub PR reviews required, CI/CD automated testing, staging environment
- **Monitoring:** Azure Application Insights, anomaly detection, alert escalation (PagerDuty)
- **Backup & Recovery:** Daily automated backups (Azure PostgreSQL), 30-day retention, tested quarterly
- **Vendor Management:** Azure DPA, Clerk DPA, Azure OpenAI DPA — all documented
- **Employee Security:** Background checks, security training (annual), NDA signed
