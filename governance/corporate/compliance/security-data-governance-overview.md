# 🔐 Data Governance Overview

Owner: Aubert

*Version 1.1 – Designed for Consent, Built for Trust*

---

### 🧭 Purpose

Nzila Ventures designs products for **care, cognition, and connection** — all of which rely on responsible data stewardship. This document outlines our **foundational principles, operational policies, and jurisdictional compliance measures** for handling personal, behavioral, and clinical data across the Nzila ecosystem (Memora, ClinicConnect, CareAI, etc.).

We treat data as **borrowed trust**, not raw material.

---

## 1. 🧱 Foundational Principles

Nzila’s data governance is grounded in five enforceable tenets:

| Tenet | What It Means |
| --- | --- |
| **Minimize by Default** | Collect the least amount of data required for the function |
| **Purpose-Linked** | Every dataset must be traceable to a declared, consented use |
| **User-Led** | Users can access, correct, export, or delete their data at will |
| **Transparent & Logged** | All access and data actions are auditable |
| **Governed, Not Implied** | No silent assumptions. Every use must be defined and approved |

---

## 2. 📜 Frameworks & Legal Alignment

Nzila's data practices comply with the following:

| Jurisdiction | Framework | Implementation |
| --- | --- | --- |
| 🇨🇦 Quebec | **Law 25** | Consent granularity, anonymization protocols, breach readiness |
| 🇨🇦 Canada (Federal) | **PIPEDA** | Accountability, safeguarding, access logs |
| 🇺🇸 U.S. | **HIPAA-Inspired** | Clinic-facing tools mirror HIPAA principles (not PHI storage) |
| 🌐 Global | **GDPR-Compatible + OECD AI Data Use** | Consent, access rights, lawful basis, AI data ethics layer |

---

## 3. 🧾 Data Classification & Risk Tiers

Nzila applies **tiered security and retention policies**:

| Tier | Type | Examples | Controls |
| --- | --- | --- | --- |
| **Tier 1** | Personal Health Information (PHI) | Clinical notes, test scores | AES-256 encryption, IAM lock, regional storage 🇨🇦 |
| **Tier 2** | Behavioral + AI Interaction | Companion prompts, game history | Pseudonymized; used only with consent |
| **Tier 3** | Device + Usage Meta | Timestamps, platform type, app version | Aggregated for performance insights; anonymized on collection |

---

## 4. 🔁 Data Lifecycle Management

Nzila tracks each data interaction from entry to deletion:

| Stage | Policy |
| --- | --- |
| **Collection** | Explicit opt-in required with clear use disclosure |
| **Storage** | Cloud-native, Canadian-hosted, encrypted at rest |
| **Usage** | Tied to original purpose, logged per access |
| **Sharing** | Only with consent or vetted NDA-bound vendors |
| **Retention** | Only as long as functionally necessary; defined per feature |
| **Deletion** | Self-serve deletion tools + verified request workflows |
| **Logging** | All Tier 1 & 2 access logged; companion use is session-audited |

---

## 5. 👥 Roles & Governance Responsibilities

| Role | Oversight |
| --- | --- |
| **Privacy Officer (PO)** | Law 25, DSRs, consent flows |
| **CTO** | Encryption, IAM, infra compliance |
| **Legal Lead** | Jurisdictional shifts, third-party contracts |
| **Engineering** | Data-min-safe coding practices |
| **AI Governance Council** | Oversees AI-related data use and masking |

---

## 6. 🤖 AI-Specific Data Controls

Nzila AI systems, including the Companion, must follow these rules:

- Trained only on **synthetic, simulated, or explicitly consented data**
- All behavioral models go through **Data Ethics Pre-Check**
- No live AI deployment can access raw PHI
- AI decisions tied to data are:
    - Loggable
    - Explainable to end users
    - Reversible

---

## 7. 👤 User Data Rights (Law 25-Compliant)

Nzila guarantees users the ability to:

| Right | How It’s Supported |
| --- | --- |
| **Access** | In-app or email export on request |
| **Correction** | Editable profile and caregiver-entered data |
| **Deletion** | Permanent erasure via UI or DSR form |
| **Explanation** | Plain-language summaries of Companion behavior |
| **Consent Revocation** | Real-time toggle in user settings |

All data subject requests are tracked in a **DSR Log**, maintained quarterly.

---

## 8. 🛡️ Enforcement, Breach, and Readiness

Nzila enforces its data policy via:

| Control | Details |
| --- | --- |
| **Quarterly Internal Reviews** | Led by PO + CTO |
| **Annual External Audit** | Launches in 2026 before U.S. scale-up |
| **Breach Playbook** | Includes notification, containment, remediation |
| **Grant & Clinic Review Ready** | Reports exported for funding, research, or compliance partners |

---

## 9. 📅 Maintenance & Version Control

| Field | Value |
| --- | --- |
| **Version** | 1.1 |
| **Effective Date** | [Insert Approval Date] |
| **Review Cycle** | Quarterly (internal), Annually (external) |
| **Maintained By** | Legal Lead, Privacy Officer, CTO |
| **Update Trigger** | Any material change in app data collection, clinic tools, or regional law |