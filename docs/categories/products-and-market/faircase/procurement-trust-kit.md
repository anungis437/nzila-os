> **Lineage banner:** These materials preserve the FAIRCASE positioning that CourtLens now productizes.

# FairCase — Procurement Trust Kit

## For Institutional Buyers, Vendor Risk Teams, and Procurement Officers

> **Version:** 1.0 — April 2026
> **Purpose:** Pre-answers to the vendor risk, privacy, security, and governance questions that appear in public sector and union procurement processes
> **Usage:** Attach to RFP responses, distribute to vendor risk reviewers, share with legal and IT teams

---

## 1. Vendor Overview

**Legal entity:** Nzila OS Inc.
**Product:** FairCase — Equity Intelligence Platform
**Headquarters:** Canada
**Website:** faircase.ca
**Primary contact:** Michel Nungisa, Founder (<michel@nzila.ca>)

**What FairCase does:** FairCase is an equity intelligence platform for Canadian institutions — providing AI-assisted protected grounds classification, pattern analysis, investigation workflow management, and equity accountability reporting. It is purpose-built for Anti-Black Racism and protected grounds governance.

**What FairCase is not:** FairCase is not a legal firm, not an investigation service provider, and not a human resources outsourcing vendor. FairCase is software infrastructure that supports internal institutional governance processes.

---

## 2. Data Residency and Sovereignty

**All data processed and stored in Canada.**

| Data category | Location | Provider |
|---|---|---|
| Case intake data | Canada (Azure Canada Central) | Microsoft Azure |
| Classification processing | Canada (Azure Canada Central) | Microsoft Azure |
| Identity vault | Canada (Azure Canada Central) | Microsoft Azure |
| Reports and outputs | Canada (Azure Canada Central) | Microsoft Azure |
| Backups | Canada (Azure Canada East) | Microsoft Azure |

**Key commitment:** FairCase does not transfer personal data, case data, or institutional data outside of Canada for any purpose — processing, backup, analytics, or model training.

**Applicable framework:** FairCase's data handling is designed to comply with the *Privacy Act* (R.S.C. 1985, c. P-21), *PIPEDA* (S.C. 2000, c. 5), and applicable provincial privacy legislation including *FIPPA* (Ontario), *FOIPPA* (BC), and *Act Respecting Access to Documents Held by Public Bodies* (Quebec).

**Cloud provider:** Microsoft Azure Canada — subject to Microsoft's Canadian data residency commitments and data protection agreements compliant with Canadian law.

---

## 3. Privacy Architecture

### 3.1 Identity vault

Complainant and respondent identities are stored in a separate, access-controlled identity vault. This vault is:

- Physically separated in the database from case content
- Not exposed to the classification AI — the AI analyzes anonymized case records
- Accessible only to authorized designated reviewers with explicit need-to-know access
- Logged: every access to the identity vault generates a timestamped audit record

No complainant's identity is ever visible to FairCase's classification model.

### 3.2 Role-based access controls

Access to case data is governed by role:

| Role | What they can see |
|---|---|
| Classification reviewer | Anonymized case records, classification outputs, evidence basis |
| Investigation lead | Full case record including identity (logged) |
| Equity officer | Pattern dashboard, aggregate reports (no individual identities by default) |
| Platform administrator | System configuration, access logs, no case content by default |
| FairCase implementation lead | Onboarding data only; access expires at pilot completion |

### 3.3 Data minimization

FairCase ingests only what is necessary for the classification and workflow functions. We work with your team at intake to define the minimum necessary data fields. We do not collect HR data, payroll data, or personal information beyond what is required for case classification and investigation management.

### 3.4 Retention and deletion

- Data is retained for the term of the subscription agreement
- Full data deletion is available at any time on written request
- On subscription termination, institutional data is deleted within 30 days
- Deletion confirmation is provided in writing with a signed data destruction attestation

---

## 4. Security Posture

### 4.1 Infrastructure security

| Control | Implementation |
|---|---|
| Encryption in transit | TLS 1.3 for all data transfers |
| Encryption at rest | AES-256 for all stored data (Azure managed keys) |
| Network isolation | Azure Virtual Network with private endpoints for database and storage |
| Authentication | Multi-factor authentication required for all administrative access |
| Key management | Azure Key Vault; keys rotated quarterly |
| Vulnerability scanning | Automated dependency scanning (Snyk); critical/high vulnerabilities resolved within 7 days |
| Container security | Trivy image scanning on all container builds; critical CVEs blocked from production |

### 4.2 Application security

- Input validation at all system boundaries (OWASP Top 10 mitigations applied)
- Parameterized queries throughout — no string-concatenated SQL
- Session management: secure, httpOnly, sameSite cookies; Argon2id password hashing
- Account lockout: 5 failed attempts triggers 15-minute lockout
- No client-side secret exposure; all API keys server-side only

### 4.3 Audit and monitoring

- Full audit trail for all case data access, classification events, and administrative actions
- Tamper-evident timestamps on all investigation records
- Logs retained for minimum 7 years (aligned with Canadian labour relations record-keeping standards)
- Anomalous access detection with alert escalation

### 4.4 Certifications and assessments (current status)

| Certification | Status |
|---|---|
| SOC 2 Type I | In progress — target completion Q3 2026 |
| SOC 2 Type II | Planned Q1 2027 |
| Penetration testing | Annual; most recent: Q1 2026 |
| WCAG 2.1 AA (accessibility) | In progress |

FairCase will provide penetration testing results summary and SOC 2 report upon completion to institutions requiring them for vendor approval.

---

## 5. AI Governance

FairCase's classification intelligence is an AI-assisted tool. This section describes how it is governed to ensure appropriate human oversight and prevent automated harm.

### 5.1 Human-in-the-loop requirement

**No FairCase classification output is a final determination.**

Every Medium and High confidence classification recommendation requires review and confirmation by a designated human reviewer at the institution before any institutional action is taken. The human reviewer can:

- Accept the classification (with their name and timestamp logged)
- Modify the classification (with documented rationale logged)
- Override the classification entirely (with documented rationale logged)

This design is not optional — it is structurally enforced in the platform. Cases cannot be closed or escalated based on FairCase classification alone.

### 5.2 Explainability

Every classification recommendation includes:

- The confidence level (Low / Medium / High)
- The specific factual patterns that contributed to the score
- The CanLII case references most relevant to the classification basis
- A plain-language summary of why the case was flagged

Reviewers can see exactly why the model flagged a case. They are not asked to accept a black-box score.

### 5.3 Model documentation

FairCase maintains a model card for its classification model documenting:

- Training corpus (CanLII ABR-adjacent decisions, jurisdiction coverage, date range)
- Known limitations and edge cases
- Accuracy metrics on held-out test set
- Bias assessment: false positive and false negative rates by case type
- Version history and change log

Model cards are available to institutional buyers on request.

### 5.4 What the AI does not do

- It does not make findings of fact
- It does not determine whether discrimination occurred
- It does not assess witness credibility
- It does not produce legal opinions
- It does not take any action on case data without explicit human confirmation

### 5.5 Alignment with emerging AI governance standards

FairCase's AI governance approach is designed to be consistent with:

- Canada's *Directive on Automated Decision-Making* (TBS, 2019) — human oversight requirements for federal public sector AI use
- The *Artificial Intelligence and Data Act* (AIDA) framework as it develops
- Ontario's emerging AI use guidance for public institutions
- The principle of "human decision support, not automated determination" applicable to high-stakes HR contexts

---

## 6. Contractual Protections

Every FairCase subscription agreement includes the following protections for institutional buyers:

| Protection | Detail |
|---|---|
| Data ownership | Institution retains full ownership of all case data. FairCase has no right to use institutional data for any purpose other than providing the contracted service. |
| No model training | Institutional data is never used to train, fine-tune, or improve FairCase models for other clients. |
| No onward transfer | FairCase does not share, sell, or transfer institutional data to any third party without explicit written consent. |
| Right to audit | Institutions have the right to request access logs and audit trails for their data at any time. |
| Breach notification | In the event of a security incident affecting institutional data, FairCase will notify the institution within 72 hours. |
| Termination | Either party may terminate with 30 days notice. Data deletion within 30 days of termination. |
| Indemnification | FairCase indemnifies the institution against third-party claims arising from FairCase's breach of its data handling obligations. |
| Governing law | All agreements governed by Ontario law unless otherwise specified. |

---

## 7. Subprocessors

FairCase uses the following subprocessors for core platform functions:

| Subprocessor | Function | Data location |
|---|---|---|
| Microsoft Azure | Cloud infrastructure, database, storage | Canada Central / Canada East |
| Azure OpenAI Service | AI classification processing (East US / Canada) | Processed in Canada where available; data not retained by Microsoft for model training |

FairCase will provide written notice of any material change to subprocessor arrangements with 30 days advance notice.

---

## 8. Reference Checks

FairCase will provide reference contacts from pilot institutions upon request after pilot completion. Reference contacts will be from organizations in the same sector as the prospective buyer (union → union reference; public sector → public sector reference).

Reference information available:

- Named contact at the reference institution
- Brief description of engagement scope
- Dates of engagement
- Whether the institution proceeded to annual subscription

References are subject to the reference institution's consent and will be confirmed before being shared.

---

## 9. Incident Response

In the event of a security incident:

1. FairCase's incident response team is activated within 1 hour of detection
2. Affected institution notified within 72 hours with incident description, affected data scope, and initial containment actions
3. Full incident report provided within 7 days including root cause, remediation taken, and prevention measures
4. If the incident triggers regulatory notification obligations (e.g., under PIPEDA), FairCase will support the institution in meeting those obligations

**Incident response contact:** Available 24/7 for subscribed institutions at a dedicated security contact provided at onboarding.

---

## 10. Procurement Process Support

FairCase will support institutional procurement processes with:

- Completed vendor registration forms (federal and provincial procurement systems)
- Responses to standard IT security assessment questionnaires (ITSAP, ATIP, provincial equivalents)
- Data flow diagrams and system architecture documentation on request
- Reference letter from platform implementation engagements
- Proof of insurance (commercial general liability, professional liability, cyber liability)
- Canadian business registration documentation
- Privacy impact assessment support for institutions with PIA requirements

Contact Michel Nungisa (<michel@nzila.ca>) to initiate procurement documentation.

---

*FairCase Trust Kit v1.0 — April 2026. Subject to revision as certifications are completed. For the most current version, contact <michel@nzila.ca>.*
