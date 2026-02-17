# Uniontech Vertical — Compliance & Privacy Framework

**Nzila Corp** | Last Updated: February 2026

---

## 1. Regulatory Landscape Overview

Uniontech platforms operate at the intersection of **labor law**, **pension regulation**, **privacy law**, and **financial services regulation** across Canadian and U.S. jurisdictions. Both Union Eyes and DiasporaCore (C3UO) must maintain compliance across overlapping regulatory frameworks.

---

## 2. Canadian Regulatory Framework

### 2.1 Labour Relations

| Regulation | Jurisdiction | Applicability | Key Requirements |
|-----------|-------------|--------------|-----------------|
| **Canada Labour Code (Part I)** | Federal | Federally regulated unions (telecom, banking, transport, postal) | Certification procedures, unfair labour practice protections, collective bargaining obligations, strike/lockout rules |
| **Ontario Labour Relations Act (OLRA)** | Ontario | Ontario-chartered locals | Certification, first contract arbitration, successor rights, duty of fair representation |
| **Quebec Labour Code** | Quebec | Quebec-chartered locals | Certification via vote, anti-scab provisions (s.109.1), essential services framework |
| **BC Labour Relations Code** | British Columbia | BC-chartered locals | Certification, expedited arbitration, essential services designation |
| **Provincial equivalents** | All provinces | Province-chartered locals | Each province has distinct certification thresholds, timelines, and arbitration rules |

**Union Eyes implementation:** Platform configurable per jurisdiction — election rules, certification thresholds, grievance step timelines, and arbitration procedures parameterized by province/territory.

### 2.2 Pension and Benefits Regulation

| Regulation | Scope | Union Eyes Obligations |
|-----------|-------|----------------------|
| **Pension Benefits Standards Act (PBSA)** | Federally regulated pension plans | Secure storage of pension records; contribution tracking with audit trail; actuarial data integrity; member access to pension statements |
| **Ontario Pension Benefits Act (PBA)** | Ontario pension plans | Funding status reporting; surplus/deficit disclosure; wind-up compliance |
| **Supplemental Pension Plans Act (Quebec)** | Quebec pension plans | Solvency ratio reporting; member notification requirements |
| **CAPSA Guidelines** | All Canadian jurisdictions | Governance self-assessment; investment monitoring; risk management framework for jointly trusteed plans |

**Fiduciary compliance:** Union Eyes pension forecasting module provides projections clearly labeled as **informational estimates, not actuarial advice**. Disclaimers enforced at the UI layer. Actuarial outputs require sign-off from a certified actuary (FCIA) before distribution to members.

### 2.3 Privacy Legislation

| Regulation | Jurisdiction | Key Requirements | Union Eyes / DiasporaCore Impact |
|-----------|-------------|-----------------|--------------------------------|
| **PIPEDA** | Federal / provinces without equivalent | Consent for collection, use, disclosure of personal information; right of access; breach notification to OPC within 72 hours | Union member PII (SIN, banking, health info for benefits); KYC data for DiasporaCore |
| **Quebec Law 25 (Bill 64)** | Quebec | Privacy impact assessments mandatory; DPO designation required; consent stricter than PIPEDA; data portability rights; algorithmic transparency for automated decisions | ML models (pension forecasting, churn prediction) require explainability; Quebec unions trigger full PIA |
| **Alberta PIPA** | Alberta | Similar to PIPEDA; applies to non-federally-regulated organizations | Alberta union locals covered |
| **BC PIPA** | British Columbia | Employee data protections; breach notification | BC union locals covered |
| **Ontario FIPPA / PHIPA** | Ontario | Public sector freedom of information; health information protection | Relevant for public-sector unions (OPSEU, CUPE Ontario) |

### 2.4 Financial Services Regulation (DiasporaCore)

| Regulation | Authority | Requirements |
|-----------|----------|-------------|
| **Proceeds of Crime (Money Laundering) and Terrorist Financing Act (PCMLTFA)** | FINTRAC | MSB registration; KYC/CDD for all customers; transaction monitoring; suspicious transaction reports (STRs); large cash transaction reports ($10K+); 5-year record retention |
| **Payment Clearing and Settlement Act** | Bank of Canada | Oversight of payment systems |
| **Provincial Money Services Business Acts** | Provincial regulators | Additional licensing in Quebec (AMF), BC, Alberta |

---

## 3. U.S. Regulatory Framework

### 3.1 Labor Relations

| Regulation | Authority | Key Requirements |
|-----------|----------|-----------------|
| **Labor-Management Reporting and Disclosure Act (LMRDA)** | OLMS (Dept. of Labor) | Annual financial reports (LM-2, LM-3, LM-4); officer/employee reports; member bill of rights; election standards (secret ballot, frequency); trusteeship reporting |
| **National Labor Relations Act (NLRA)** | NLRB | Certification procedures; unfair labor practice charges; bargaining unit determination |
| **Railway Labor Act** | NMB | Airline and railroad unions — distinct election and mediation procedures |

**Union Eyes implementation:** LM-2/LM-3/LM-4 report generation engine with auto-population from financial transaction data. Electronic filing format compatible with OLMS e-filing system. Officer compensation disclosure automated per LMRDA s.201.

### 3.2 Pension and Benefits (U.S.)

| Regulation | Scope | Requirements |
|-----------|-------|-------------|
| **Employee Retirement Income Security Act (ERISA)** | Private-sector pension and welfare plans | Fiduciary standards; reporting (Form 5500); disclosure to participants; claims procedures; plan document compliance |
| **Multiemployer Pension Reform Act (MPRA)** | Multiemployer (Taft-Hartley) plans | Critical and declining status certification; benefit suspension procedures; PBGC reporting |
| **Affordable Care Act (ACA)** | Health benefit plans | Employer mandate reporting; plan compliance for union health trusts |

### 3.3 U.S. Privacy

| Regulation | Scope | Impact |
|-----------|-------|--------|
| **No federal comprehensive privacy law** | — | State-by-state compliance required |
| **California Consumer Privacy Act (CCPA/CPRA)** | CA-based members | Right to know, delete, opt-out; data processing agreements |
| **State biometric privacy laws (IL BIPA)** | Illinois | Biometric data (if used for authentication) requires explicit consent |
| **HIPAA** | Health plan operations | Protected health information for union health trusts |

---

## 4. Data Residency Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Canadian union data** | Azure Canada Central (Toronto) — primary; Azure Canada East (Quebec City) — DR |
| **U.S. union data** | Azure US East (Virginia) — primary; Azure US East 2 (Virginia) — DR |
| **No cross-border transfer of Canadian member PII** | Network policies enforce geo-fencing; database-level CHECK constraints on region column |
| **DiasporaCore transaction data** | Azure Canada Central (FINTRAC requirement); transaction logs replicated to DR within Canada |
| **Backups** | Geo-redundant storage (GRS) within same country; encrypted at rest (AES-256) |
| **ML training data** | Anonymized/pseudonymized before use; training compute restricted to data-resident region |

---

## 5. Audit Trail Requirements

### 5.1 Immutable Audit Logging

All platforms implement append-only audit logs for regulatory compliance:

| Event Category | Retention | Log Contents | Regulation |
|---------------|-----------|-------------|-----------|
| **Authentication events** | 7 years | User, timestamp, IP, device, success/failure, MFA method | SOC 2, PIPEDA |
| **Member data access** | 7 years | Who accessed, what fields, timestamp, purpose | PIPEDA, Law 25, LMRDA |
| **Financial transactions** | 7 years | Transaction type, amount, parties, authorization, reconciliation | FINTRAC (PCMLTFA), LMRDA, ERISA |
| **Grievance actions** | Duration of grievance + 7 years | Filed, escalated, settled, arbitrated — with actor and timestamp | Canada Labour Code, OLRA |
| **Election events** | 3 election cycles | Nomination, ballot cast (anonymized), count, certification | LMRDA, Canada Labour Code |
| **Pension data modifications** | Lifetime of plan + 7 years | Contribution changes, forecast runs, benefit calculations | PBSA, ERISA |
| **RLS policy changes** | Indefinite | Policy created/modified/deleted, before/after state | SOC 2, internal security |
| **KYC/AML decisions** | 5 years post-relationship | Verification results, risk scores, escalations, SAR filings | FINTRAC |

### 5.2 Audit Log Architecture

- **Storage:** Azure Blob Storage (immutable storage with legal hold and time-based retention policies)
- **Integrity:** SHA-256 hash chain — each log entry references predecessor hash
- **Access:** Read-only for auditors via dedicated audit portal; no delete capability for any role
- **Search:** Azure Cognitive Search index for fast retrieval during investigations

---

## 6. Security Controls

### 6.1 SOC 2 Type II Roadmap

| Phase | Timeline | Scope |
|-------|----------|-------|
| **Readiness Assessment** | Q2 2026 | Gap analysis against Trust Service Criteria (Security, Availability, Confidentiality) |
| **Control Implementation** | Q3–Q4 2026 | Remediate gaps; implement evidence collection automation; policy documentation |
| **Type I Audit** | Q1 2027 | Point-in-time assessment of control design |
| **Observation Period** | Q2–Q3 2027 | 6-month operating effectiveness window |
| **Type II Audit** | Q4 2027 | Operating effectiveness audit; report issued Q1 2028 |
| **Annual Renewal** | Annually | Continuous monitoring; annual re-audit |

### 6.2 Penetration Testing Schedule

| Test Type | Frequency | Scope | Provider |
|-----------|-----------|-------|---------|
| **External network pentest** | Quarterly | Public-facing endpoints, APIs, CDN | Third-party certified firm |
| **Internal network pentest** | Semi-annually | Azure VNET, ACA internal comms, Redis | Third-party certified firm |
| **Application pentest** | Semi-annually | Union Eyes + DiasporaCore full stack | Third-party certified firm |
| **RLS isolation testing** | Quarterly | Cross-tenant data leakage (238 policies) | Internal security team + external validation |
| **Social engineering** | Annually | Phishing simulation, physical access attempts | Third-party certified firm |

### 6.3 Incident Response Procedures

| Severity | Definition | Response Time | Escalation |
|----------|-----------|--------------|-----------|
| **P0 — Critical** | Data breach, RLS failure, financial transaction compromise | 15 minutes to acknowledge; 1 hour to contain | CTO + Legal + Privacy Officer; OPC notification within 72 hours |
| **P1 — High** | Service outage, authentication bypass, unauthorized access attempt | 30 minutes to acknowledge; 4 hours to contain | Engineering lead + Security team |
| **P2 — Medium** | Performance degradation, non-critical vulnerability discovered | 4 hours to acknowledge; 24 hours to remediate | Engineering on-call |
| **P3 — Low** | Minor UI issue, informational security finding | Next business day | Standard triage |

**Breach notification obligations:**
- **PIPEDA:** OPC notification "as soon as feasible" (interpret as 72 hours); affected individuals notified
- **Quebec Law 25:** CAI notification within 72 hours; affected individuals notified; risk of serious injury threshold
- **FINTRAC:** Suspicious activity — immediate STR filing; no tipping-off
- **LMRDA / OLMS:** Report financial data integrity issues to DOL if affecting LM filings

---

## 7. Data Retention & Destruction Policies

| Data Category | Retention Period | Destruction Method | Legal Basis |
|--------------|-----------------|-------------------|-------------|
| Member PII (active) | Duration of membership + 7 years | Cryptographic erasure (key destruction) | PIPEDA, LMRDA |
| Member PII (inactive) | 7 years from last activity | Cryptographic erasure | PIPEDA |
| Financial records | 7 years from transaction date | Secure deletion after retention | PCMLTFA, LMRDA, CRA |
| Pension records | Lifetime of plan participant + 7 years | Cryptographic erasure | PBSA, ERISA |
| Grievance records | Last action + 7 years | Secure deletion | Labour relations acts |
| Election records | 3 election cycles | Secure deletion | LMRDA, Canada Labour Code |
| KYC documents | 5 years post-customer relationship | Secure deletion (FINTRAC) | PCMLTFA |
| Audit logs | Per event category (see §5.1) | No destruction during retention; auto-purge after | SOC 2, regulatory |
| ML training data | Anonymized — indefinite; pseudonymized — 3 years | Re-anonymization review annually | Law 25, PIPEDA |
| Backups | 90 days rolling; annual snapshots for 7 years | Overwrite (rolling); cryptographic erasure (annual) | Operational + regulatory |

**Right to deletion process:** Member requests deletion → 30-day verification → legal hold check → retain minimum required by regulation → cryptographically erase remainder → confirmation to member within 30 days.

---

## 8. Ongoing Compliance Operations

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Privacy Impact Assessment (PIA) | Before each major feature launch; annually for existing features | Privacy Officer |
| FINTRAC compliance review | Quarterly | Compliance Officer |
| RLS policy audit | Quarterly | Security Engineering |
| Employee privacy training | Annually + onboarding | HR + Privacy Officer |
| Regulatory landscape scan | Monthly | Legal |
| Data retention enforcement review | Semi-annually | Data Governance |
| Third-party vendor risk assessment | Annually + onboarding | Security + Procurement |
| SOC 2 evidence collection | Continuous (automated where possible) | Security Engineering |

---

*Document owner: Legal, Compliance & Privacy | Review cycle: Quarterly compliance review; ad-hoc for regulatory changes*
