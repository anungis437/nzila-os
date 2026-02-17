# Fintech Compliance & Data Privacy Framework

## Overview

Nzila Corp operates **DiasporaCore V2/C3UO** and **STSA** across multiple jurisdictions (Canada, US, UK, EU, and African receiving countries), requiring a robust compliance architecture covering anti-money laundering (AML), know-your-customer (KYC), payment card security, data privacy, and cross-border financial regulations. This document defines our regulatory obligations, compliance controls, and audit framework.

---

## FINTRAC Compliance (Canada)

### Money Services Business (MSB) Registration

- **Registration**: DiasporaCore registered as an MSB with FINTRAC under the Proceeds of Crime (Money Laundering) and Terrorist Financing Act (PCMLTFA)
- **Activities Covered**: Foreign exchange dealing, money transferring, issuing/redeeming money orders
- **Renewal**: Biennial renewal with updated compliance officer designation and business activity confirmation
- **Compliance Officer**: Designated compliance officer with direct reporting to the CEO and board

### Reporting Obligations

| Report Type | Threshold | Deadline | Automation Status |
|------------|-----------|----------|-------------------|
| Suspicious Transaction Report (STR) | Any suspected ML/TF | 30 days of detection | Semi-automated: flagged by system, reviewed by compliance officer |
| Large Cash Transaction Report (LCTR) | $10,000+ CAD | 15 days | Fully automated |
| Electronic Funds Transfer Report (EFTR) | $10,000+ CAD (international) | 5 days | Fully automated |
| Terrorist Property Report | Any match | Immediately | Automated screening + manual review |
| Casino Disbursement Report | N/A | N/A | Not applicable |

### Record-Keeping Requirements

- **Transaction Records**: All remittance transactions retained for 5 years from date of transaction
- **Client Identification**: KYC documents retained for 5 years after account closure
- **Compliance Program Records**: Risk assessments, training records, audit reports retained for 5 years
- **Storage**: Encrypted at rest (AES-256) in AWS S3 with lifecycle policies, Canadian data residency for FINTRAC-reportable records

---

## KYC / AML Framework

### Identity Verification Tiers

```
Tier 1 — Basic Verification
├── Requirements: Phone number (SMS OTP) + email + full legal name + DOB
├── Limits: $500 CAD/month send, $200/transaction
├── Risk Level: Low
└── Verification Method: Automated

Tier 2 — Standard Verification
├── Requirements: Government-issued photo ID (passport, driver's license, national ID)
│                 + Selfie biometric match (Stripe Identity, >95% confidence)
├── Limits: $5,000 CAD/month send, $2,000/transaction
├── Risk Level: Medium
└── Verification Method: Automated with manual fallback (<5% of cases)

Tier 3 — Enhanced Verification
├── Requirements: Proof of address (utility bill, bank statement <3 months)
│                 + Source of funds declaration
│                 + Enhanced due diligence questionnaire
├── Limits: $25,000 CAD/month send, $10,000/transaction
├── Risk Level: Medium-High
└── Verification Method: Automated document verification + compliance officer review

Tier 4 — Premium / Institutional
├── Requirements: In-person or video interview
│                 + Business documentation (for credit unions)
│                 + Ongoing monitoring with quarterly reviews
├── Limits: Custom (negotiated)
├── Risk Level: High
└── Verification Method: Full manual due diligence
```

### Enhanced Due Diligence (EDD) Triggers

- Transactions involving high-risk jurisdictions (FATF grey/black list countries)
- Users identified as Politically Exposed Persons (PEPs) or associates
- Unusual transaction patterns (sudden increase in volume, multiple recipients in different countries)
- Source of funds inconsistent with declared occupation or income level
- Adverse media screening matches

### PEP Screening

- **Provider**: ComplyAdvantage API — real-time screening against 10,000+ global PEP lists
- **Frequency**: At onboarding (Tier 2+), and ongoing monitoring with daily batch re-screening
- **Match Handling**: Automated PEP matches trigger Enhanced Due Diligence workflow; compliance officer review within 48 hours
- **Scope**: Domestic and foreign PEPs, heads of international organizations, immediate family members, known close associates

### Sanctions Screening

- **Lists Monitored**: OFAC (US), Canadian Consolidated Autonomous Sanctions List, UN Security Council, EU Consolidated List, UK HMT
- **Screening Points**: Account creation, every outbound remittance, recipient addition, name/address changes
- **False Positive Management**: Fuzzy matching algorithm with manual review queue; target <2% false positive rate
- **Escalation**: True matches immediately frozen, reported to FINTRAC and relevant authorities within 24 hours

---

## PCI-DSS Compliance

### Scope & SAQ Level

- **SAQ A-EP**: DiasporaCore does not store, process, or transmit cardholder data — all payment card processing handled by Stripe (PCI Level 1 certified)
- **Scope Reduction**: Tokenization via Stripe Elements ensures no PAN data enters our infrastructure

### Controls Implemented

| PCI-DSS Requirement | Implementation |
|---------------------|---------------|
| Req 1: Firewall configuration | AWS Security Groups + WAF rules, network segmentation between services |
| Req 2: No vendor defaults | Automated configuration hardening via Ansible, no default passwords |
| Req 3: Protect stored data | No PAN storage; Stripe tokens only. PII encrypted with AWS KMS |
| Req 4: Encrypt transmission | TLS 1.3 enforced on all endpoints, HSTS headers, certificate pinning on mobile |
| Req 5: Anti-malware | AWS GuardDuty, container image scanning with Trivy |
| Req 6: Secure development | OWASP Top 10 in CI/CD pipeline, dependency scanning (Snyk), code review required |
| Req 7: Access control | RBAC with principle of least privilege, MFA on all admin access |
| Req 8: Authentication | JWT tokens with 15-min expiry, refresh token rotation, biometric on mobile |
| Req 9: Physical security | AWS manages physical — SOC 2 Type II certified data centers |
| Req 10: Logging & monitoring | Centralized logging (CloudWatch + ELK), tamper-evident audit logs |
| Req 11: Security testing | Quarterly vulnerability scans, annual penetration testing by third party |
| Req 12: Security policy | Information security policy reviewed annually, security awareness training quarterly |

---

## OSFI Guidelines

### Applicability

- OSFI oversight applies **if and when** Nzila pursues a Canadian banking license (planned evaluation in 2028)
- Current MSB status does not require OSFI compliance, but we proactively align with guidelines for future readiness

### Key Preparatory Measures

- **Capital Adequacy**: Maintain minimum $500K in liquid reserves (exceeding MSB requirements)
- **Operational Resilience (Guideline B-13)**: Business continuity plan with <4hr RTO, <1hr RPO for critical payment systems
- **Technology Risk (Guideline B-13)**: Cloud risk management framework, third-party vendor due diligence, incident response procedures
- **Outsourcing (Guideline B-10)**: Documented risk assessments for all material outsourcing (AWS, Stripe, Flutterwave, ComplyAdvantage)

---

## Cross-Border Regulatory Framework

### Licensing by Jurisdiction

| Jurisdiction | License Required | Status | Timeline |
|-------------|-----------------|--------|----------|
| Canada (Federal) | FINTRAC MSB | Active | Registered |
| Canada (Quebec) | AMF Money Services License | In Progress | Q2 2025 |
| United States (Federal) | FinCEN MSB | Planned | Q1 2026 |
| New York | BitLicense / MTL | Planned | Q2 2026 |
| Texas, Georgia, California | State MTL | Planned | Q1-Q3 2026 |
| United Kingdom | FCA Payment Institution (Small) | Planned | Q3 2026 |
| European Union | PSD2 — Payment Institution License | Planned | Q1 2027 |
| Nigeria (receiving) | CBN International Money Transfer Operator (IMTO) partnership | Via Flutterwave | Active |
| Kenya (receiving) | CBK approval via M-Pesa partnership | Via Safaricom | Active |
| DRC (receiving) | BCC mobile money partnership | Via Orange Money | Active |

### US State-by-State Strategy

- **Priority States** (Phase 2): New York (largest African diaspora), Texas (growing Nigerian community), Georgia (Ghanaian/Ethiopian communities), California (diverse diaspora)
- **Surety Bond Requirements**: $25K-$500K per state, budgeted at $150K total for initial 4 states
- **Compliance Cost**: Estimated $80K annual for US multi-state licensing (legal, filings, audits)

---

## Data Privacy

### PIPEDA Compliance (Canada)

- **Consent**: Explicit opt-in consent for data collection at registration; granular consent for marketing communications
- **Purpose Limitation**: Personal data used only for stated purposes (account management, transaction processing, KYC, regulatory compliance)
- **Data Access Rights**: Users can request full data export (JSON/PDF) within 30 days, accessible via Settings → Privacy → Download My Data
- **Data Deletion**: Account deletion request honored within 30 days, with exception for records required by FINTRAC (retained 5 years per regulatory obligation)
- **Privacy Officer**: Designated privacy officer responsible for PIPEDA compliance, breach notification, and privacy impact assessments

### GDPR Compliance (EU Users)

- **Legal Basis**: Contractual necessity (processing transactions), legal obligation (AML/KYC), legitimate interest (fraud prevention), consent (marketing)
- **Data Minimization**: Collect only data necessary for service provision and regulatory compliance
- **Right to Erasure**: Honored except where retention is required by anti-money laundering regulations
- **Data Portability**: Structured, machine-readable export (JSON) available on request
- **Data Protection Officer (DPO)**: Appointed DPO for EU operations when user base exceeds 5,000 EU residents
- **Cross-Border Transfers**: Standard Contractual Clauses (SCCs) for data transferred outside EU/EEA

### Data Residency Requirements

| Data Type | Residency | Justification |
|-----------|-----------|---------------|
| FINTRAC-reportable transaction records | Canada (ca-central-1) | PCMLTFA regulatory requirement |
| EU user personal data | EU (eu-west-1) or Canada (adequacy decision) | GDPR compliance |
| KYC documents (government IDs, selfies) | User's country of registration | Data sovereignty, minimize cross-border transfer |
| Trading data (STSA) | Canada or US (market data source) | Performance optimization |
| Analytics / aggregated data | Any region (anonymized) | No PII, no residency requirement |

---

## Audit Framework

### Transaction Audit Trails

- **Immutable Logging**: Every financial transaction creates an append-only audit log entry with timestamp, actor, action, before/after state, IP address, device fingerprint
- **Storage**: Separate audit database (PostgreSQL with append-only permissions), replicated to S3 for long-term archival
- **Retention**: 7 years (exceeding the 5-year FINTRAC minimum for operational flexibility)
- **Access Controls**: Read-only access restricted to compliance officer, external auditors, and legal counsel

### Regulatory Reporting Automation

| Report | Frequency | Automation Level | Tool |
|--------|-----------|-----------------|------|
| FINTRAC STR/LCTR/EFTR | Event-driven | Automated generation, manual review before submission | Custom + FINTRAC XML API |
| US FinCEN SAR/CTR | Event-driven | Automated generation | Custom + FinCEN BSA E-Filing |
| UK FCA transaction reports | Quarterly | Semi-automated | Custom + FCA Gabriel |
| Board compliance summary | Monthly | Automated dashboard | Metabase + custom queries |
| External audit package | Annually | Semi-automated compilation | Custom scripts |

### Compliance Calendar

| Month | Activity |
|-------|----------|
| January | Annual compliance risk assessment, policy review kickoff |
| February | FINTRAC effectiveness review submission |
| March | Q1 board compliance report, external audit prep |
| April | Annual penetration test, PCI-DSS assessment |
| May | Privacy impact assessment (new features/corridors) |
| June | Q2 board compliance report, staff training (AML/KYC) |
| July | Mid-year sanctions list review, vendor due diligence refresh |
| August | Disaster recovery test, business continuity plan review |
| September | Q3 board compliance report, FINTRAC biennial renewal (if applicable) |
| October | Annual security awareness training for all staff |
| November | Budget planning for next year's compliance costs |
| December | Q4 board compliance report, year-end regulatory filings, policy attestation |
