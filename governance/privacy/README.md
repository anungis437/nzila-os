# Nzila Privacy Operations Program

This directory operationalizes the Info-Tech "Mature Your Privacy Operations"
6-phase methodology against the Nzila OS portfolio.

| Phase | Deliverable | Location |
|-------|-------------|----------|
| 1. Assess Privacy Readiness | Readiness Assessment | [readiness-assessment.md](readiness-assessment.md) |
| 2. Privacy Documentation | Privacy Notice (external) | [public/privacy-notice.md](public/privacy-notice.md) |
| 2. Privacy Documentation | Cookie Policy (external) | [public/cookie-policy.md](public/cookie-policy.md) |
| 3. Manage Privacy Risks | DPIA process + template | [dpia/](dpia/) |
| 3. Manage Privacy Risks | AI-specific PIA | [ai-pia/](ai-pia/) (existing) |
| 3. Manage Privacy Risks | Data Processing Agreement template | [vendor/data-processing-agreement-template.md](vendor/data-processing-agreement-template.md) |
| 4. Data Classification | Policy | [policies/data-classification-policy.md](policies/data-classification-policy.md) |
| 4. Data Classification | Standard | [policies/data-classification-standard.md](policies/data-classification-standard.md) |
| 4. Data Retention | Policy | [policies/data-retention-policy.md](policies/data-retention-policy.md) |
| 4. Data Retention | Schedule (GDPR-aligned) | [policies/data-retention-schedule.md](policies/data-retention-schedule.md) |
| 4. Cross-Border | SCCs | [vendor/standard-contractual-clauses.md](vendor/standard-contractual-clauses.md) |
| 5. Data Subjects | DSAR runbook | [dsar/README.md](dsar/README.md) |
| 5. Incidents | Security incident management plan | [incidents/security-incident-management-plan.md](incidents/security-incident-management-plan.md) |
| 5. Incidents | Breach reporting requirements | [incidents/breach-reporting-requirements.md](incidents/breach-reporting-requirements.md) |
| 6. Measure | Privacy metrics & KPIs | [metrics/privacy-metrics.md](metrics/privacy-metrics.md) |
| 6. Measure | Annual Program Report template | [metrics/data-privacy-program-report-template.md](metrics/data-privacy-program-report-template.md) |

## Governing frameworks

GDPR, CCPA/CPRA, PIPEDA (and OPC AI proposals), HIPAA Security & Privacy Rules
(where applicable), NIST Privacy Framework 1.0, ISO/IEC 27701:2019, plus
Cavoukian's 7 Privacy by Design principles.

## Roles

- **Privacy Lead / DPO** — owns this directory; approves PIAs, DPAs, breach notifications.
- **Security Lead** — co-owns incident response; see [`../security/`](../security/).
- **Surface Owners** — accountable for their app's PIA, retention, and DSAR coverage.
- **Vendor Manager** — maintains vendor inventory + DPAs + SCCs.

## Reference material

The Info-Tech bundle that informed this program lives in `infotech/`
(gitignored, internal use only — commercial license, do not redistribute).
