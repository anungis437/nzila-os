# SentryIQ360 — Regulatory Compliance & Data Privacy

## Overview

SentryIQ360 operates within one of Canada's most heavily regulated industries. As a platform connecting independent insurance brokers to multiple carriers, compliance obligations span provincial insurance regulation, federal privacy law, industry data standards, and enterprise security certifications. This document outlines the compliance framework governing SentryIQ360's design, operations, and data handling.

---

## FSRA — Financial Services Regulatory Authority of Ontario

### Broker Licensing Compliance
- SentryIQ360 validates that every broker user holds a valid RIBO (Registered Insurance Brokers of Ontario) license
- License verification integrated into onboarding: broker enters RIBO number, system checks against public registry
- Suspended or expired licenses trigger automatic account deactivation with notification to agency principal
- Platform prevents unlicensed users from generating quotes or submitting applications

### Errors & Omissions (E&O) Requirements
- Agency E&O policy details captured during onboarding: carrier, policy number, expiry date
- E&O expiry alerts: 90/60/30-day advance warnings to agency principal
- SentryIQ360 does not provide coverage advice — all recommendations are broker-initiated; platform is a comparison tool
- Disclaimer framework: clear disclosures on every comparison output that broker professional judgment governs recommendations

### Continuing Education (CE) Tracking
- Optional CE tracking module for agency management
- RIBO requires brokers to complete credits per licensing cycle
- Track completed courses, credits earned, cycle deadlines per broker
- Alert agency principals when team members approach CE deadlines

### FSRA Market Conduct
- SentryIQ360 audit trail demonstrates fair treatment of customers by documenting all quotes presented
- Full quote history retained per client: shows broker considered multiple carriers, not just defaulting to one
- Compliant with FSRA's principles-based approach to fair treatment of customers
- No hidden carrier prioritization: comparison results ordered by objective criteria (price, coverage breadth), not by commercial arrangements with carriers

---

## Provincial Insurance Regulators

### Cross-Provincial Licensing
- Canada's insurance regulation is provincially administered — each province has its own regulatory body
- SentryIQ360 supports multi-provincial broker operations with jurisdiction-aware compliance

| Province | Regulatory Body | License Type | SentryIQ360 Status |
|----------|----------------|-------------|-------------------|
| Ontario | FSRA / RIBO | Registered Insurance Broker | Phase 1 (Active) |
| Alberta | Alberta Insurance Council (AIC) | General Insurance Agent | Phase 2 (Planned) |
| British Columbia | Insurance Council of BC (ICBC) | General Insurance Agent | Phase 2 (Planned) |
| Quebec | AMF (Autorité des marchés financiers) | Damage Insurance Broker | Phase 3 (Planned) |
| Atlantic | Provincial Superintendents | Varies by province | Phase 3 (Planned) |
| Manitoba | Insurance Council of Manitoba | General Insurance Agent | Phase 3 (Planned) |
| Saskatchewan | General Insurance Council of SK | General Insurance Agent | Phase 3 (Planned) |

### Regulatory Reporting
- SentryIQ360 generates regulatory-compliant reports per provincial requirements
- Transaction logs exportable in formats required by provincial audit processes
- Broker activity reports for regulatory inspections: quotes generated, policies placed, commissions earned
- Automated annual reporting templates for brokerages that must file activity summaries

---

## PIPEDA — Personal Information Protection and Electronic Documents Act

### Data Collection Principles
- **Consent**: Explicit opt-in consent collected from policyholders before their personal information is submitted to carriers
- **Purpose limitation**: Client data collected exclusively for insurance quoting, policy placement, and ongoing policy management
- **Minimization**: Only data necessary for insurance quoting is collected — no extraneous personal information
- **Accuracy**: Client data verified at point of entry; brokers responsible for accuracy under brokerage agreement

### Consent Management
- Granular consent tracking per client: consent to quote, consent to share with specific carriers, consent for analytics
- Consent records immutable once captured — timestamp, IP address, content of consent stored permanently
- Withdrawal mechanism: clients can request data deletion; SentryIQ360 propagates deletion to carrier submissions where possible
- Broker agencies act as data controllers; SentryIQ360 acts as data processor under written Data Processing Agreements

### Breach Notification Protocol
- **Detection**: Automated monitoring for unauthorized access via Azure Security Center alerts
- **Assessment**: Security team evaluates within 4 hours — is this a real risk of significant harm?
- **Notification timeline**: 72-hour notification to Office of the Privacy Commissioner of Canada (OPC) if breach poses real risk
- **Individual notification**: Affected individuals notified as soon as feasible with description of breach, data affected, mitigation steps
- **Broker notification**: Affected broker agencies notified within 24 hours with remediation guidance
- **Record keeping**: All breaches logged regardless of severity, reviewed quarterly by compliance officer

### Data Retention
- Active client data: retained for duration of active policy + 12 months post-expiry
- Expired/cancelled policy data: archived for 7 years (regulatory minimum for insurance records)
- Quote history: retained for 7 years to support E&O defense and regulatory audit
- Deleted on request: client data removed within 30 days of valid deletion request (subject to regulatory retention requirements)
- Automated data lifecycle: archival and deletion jobs run monthly

---

## CSIO Standards Compliance

### EDI Data Exchange
- SentryIQ360 implements CSIO XML v3.x specifications for broker-carrier data exchange
- All quote requests and submissions formatted in CSIO-compliant XML structures
- CSIO membership maintained: participate in standards development committees
- Annual CSIO compliance review to align with specification updates

### eDocs Integration
- Automated download and storage of carrier-issued policy documents through CSIO eDocs
- Documents indexed by client, policy number, and document type for fast retrieval
- Supports all CSIO document types: policy declarations, endorsements, certificates, cancellation notices
- Document integrity: SHA-256 hash verification on all downloaded documents

### My Proof of Insurance
- Digital proof of auto insurance (pink card) issuance through CSIO's digital standards
- Client-accessible through SentryIQ360 client portal on mobile devices
- Real-time policy status verification for law enforcement and other verifying parties

### Electronic Signatures
- CSIO-compliant electronic signature capture for policy applications and endorsements
- Legally binding under Ontario's Electronic Commerce Act, 2000
- Signature audit trail: signer identity, timestamp, IP address, document hash

---

## Anti-Rebating Compliance

### Regulatory Framework
- Canadian provincial insurance acts prohibit brokers from offering rebates or inducements to purchase insurance
- SentryIQ360 ensures no platform feature constitutes a rebate or unfair inducement

### Platform Safeguards
- No client-facing discounts, rewards, or cashback tied to policy purchases
- Broker referral program rewards brokers (B2B), not policyholders (B2C) — compliant with anti-rebating rules
- Free trial access limited to broker/agency evaluation — no client-facing benefit during trial
- All promotional materials reviewed by compliance counsel before publication
- Carrier placement fees are B2B override commissions, not client rebates
- Rate comparison presented transparently without inflating or deflating any carrier's actual rates

---

## Carrier Data Agreements

### API Usage Terms
- Formal data sharing agreements executed with each integrated carrier
- Agreements specify: permitted data use, retention limits, security standards, audit rights
- Carrier rate data used exclusively for broker comparison — never shared with competing carriers
- SentryIQ360 acts as a secure intermediary, not a data aggregator for commercial resale

### Placement Reporting
- Monthly placement reports provided to each carrier: policies bound via SentryIQ360, premium volume, geographic distribution
- Reports compliant with carrier reporting requirements and commission reconciliation standards
- Data anonymized at broker level where carrier agreement requires — aggregate placement data only
- Override commission reconciliation: automated monthly matching of expected vs received commissions

### Carrier Audit Rights
- Carrier agreements include right to audit SentryIQ360's handling of carrier-specific data
- Annual audit readiness review: ensure all carrier data handling meets agreement requirements
- Penetration testing results shared with carriers upon request under NDA

---

## SOC 2 Compliance Roadmap

### Trust Service Criteria

| Criterion | Description | Implementation Status |
|-----------|------------|----------------------|
| **Security** | Protection against unauthorized access | Azure AD B2C, MFA, RBAC, encryption — In Progress |
| **Availability** | System uptime and performance commitments | 99.9% SLA target, Azure HA — In Progress |
| **Confidentiality** | Protection of confidential information | Encryption at rest/transit, tenant isolation — In Progress |
| **Processing Integrity** | Accurate and complete data processing | Input validation, reconciliation checks — Planned |
| **Privacy** | Personal information handling per criteria | PIPEDA framework, consent management — In Progress |

### Audit Timeline
- **Q2 2026**: Gap assessment with external SOC 2 auditor (estimated cost: $30K-50K)
- **Q4 2026**: SOC 2 Type I report — point-in-time assessment of control design
- **Q4 2027**: SOC 2 Type II report — 6-12 month assessment of control operating effectiveness
- **Ongoing**: Annual SOC 2 Type II renewal with continuous monitoring

### Continuous Monitoring
- Azure Security Center: threat detection, vulnerability assessment, compliance scoring
- Automated weekly vulnerability scans of application and infrastructure
- Quarterly penetration testing by third-party security firm
- Log aggregation: Azure Monitor + Log Analytics workspace with 90-day retention
- Incident response runbook: documented procedures for security events with escalation paths

---

## Record Retention Requirements

### Insurance-Specific Retention
| Record Type | Minimum Retention | SentryIQ360 Policy |
|------------|------------------|-------------------|
| Policy documents | 7 years post-expiry | Azure Blob archival tier |
| Quote history | 7 years | PostgreSQL + archival storage |
| Commission records | 7 years | Database with export capability |
| Client consent records | Permanent | Immutable audit log |
| Submission correspondence | 7 years | Encrypted document storage |
| Regulatory reports | 10 years | Cold archival storage |

### Audit Trail Integrity
- All user actions logged: login, quote, submission, policy change, data export, admin action
- Logs are append-only — no retroactive modification or deletion of audit records
- Cryptographic integrity: periodic hash chain verification of audit log continuity
- Audit logs stored separately from application data with independent access controls
- Export capability: audit logs exportable in CSV/JSON for regulatory submissions within 24 hours of request

---

*Nzila Corp — SentryIQ360 Compliance & Privacy Framework v1.0 — Confidential*
