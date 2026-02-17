# 🛡️ Incident Response Playbook (IRP)

Owner: Aubert

**Version:** 1.0

**Maintained By:** COO, Privacy Officer, CTO

**Review Cycle:** Quarterly or after any security event

**Legal Reference:** CBCA, PIPEDA, Law 25, NIST 800-61r2, ISO/IEC 27035

**Last Updated:** [Insert Date]

---

## 🧭 **1. Purpose**

This Incident Response Playbook provides a clear, repeatable framework for identifying, managing, mitigating, and documenting security incidents across Nzila Ventures and its ventures (e.g., Memora, Optiva). It ensures rapid containment, regulatory compliance, and protection of stakeholder trust.

---

## ⚙️ **2. Scope**

This playbook applies to:

- All Nzila platforms, infrastructure, and SaaS tools
- Employees, contractors, vendors with system access
- Data governed under Law 25 (QC), PIPEDA (CAN), GDPR (EU), HIPAA-readiness (US)
- Systems that store, process, or transmit personal, behavioral, or clinical data

---

## 🚨 **3. Incident Classification Levels**

| Level | Description | Example Scenarios |
| --- | --- | --- |
| **Level 1: Low** | No sensitive data or systems compromised | Phishing attempt blocked, minor misconfig |
| **Level 2: Moderate** | Limited exposure of internal data or vendor error | Misrouted email with internal-only docs |
| **Level 3: High** | Potential breach of PHI/PPI, external notification required | API exposed personal data to unauthorized parties |
| **Level 4: Critical** | Active threat, ransomware, widespread system failure | Unauthorized database access, compromised infrastructure |

---

## 🛠️ **4. Response Roles & Team**

| Role | Responsibility |
| --- | --- |
| **Incident Commander (IC)** | Appointed by CTO or COO; owns full lifecycle of response |
| **CTO / Engineering Lead** | Technical triage, log collection, system patching |
| **Privacy Officer** | Regulatory notification, Law 25 & PIPEDA alignment |
| **COO** | Internal coordination, continuity planning |
| **CEO / Comms Lead** | Stakeholder comms, media, investor updates |
| **Legal Advisor** | Liabilities, contracts, breach notification reviews |

> See also: Role-Based Security Contact Sheet (linked)
> 

---

## 🧩 **5. Incident Lifecycle**

| Phase | Description | Tools |
| --- | --- | --- |
| **1. Detection & Intake** | Incident observed, flagged via monitoring or employee report | Email, Microsoft Defender, Brevo Alert, manual flag |
| **2. Logging & Triage** | Logged in IR Tracker; severity classified within 1 hour | Notion IR Log, Severity Matrix |
| **3. Containment & Mitigation** | Access revoked, system isolated, patches initiated | Defender, IAM console, GitHub |
| **4. Investigation** | Timeline mapped, root cause analyzed, forensic trace started | SIEM logs, session replay, audit trail |
| **5. Notification** | Stakeholders informed, legal compliance reviewed | Law 25 breach window (72 hrs) |
| **6. Recovery** | System restored, redundancies tested, downtime resolved | Restore backups, QA checklist |
| **7. Postmortem & Review** | Lessons learned, IR documentation completed | Notion IR Retrospective Template |

---

## 📞 **6. Notification Requirements**

| Jurisdiction | Regulation | Timeline |
| --- | --- | --- |
| **Canada (QC)** | Law 25 | Must notify CAI + affected users within 72 hours |
| **Canada (Federal)** | PIPEDA | Mandatory breach notification to OPC if “real risk of significant harm” |
| **US (Optional)** | HIPAA | 60-day notice to HHS if PHI compromised (U.S. deployment phase) |
| **Internal** | Staff, partners | Within 24 hours, confidential summary + mitigation steps |

---

## 🔐 **7. Legal & Forensic Documentation**

- Maintain **secure evidence chain** (export logs, IP traces, user actions)
- Timestamped IR Tracker log (Notion or secure Google Sheet)
- Compile an **Incident Record Bundle**:
    - IR Tracker entry
    - Incident summary & severity classification
    - Evidence screenshots / logs / forensic notes
    - Timeline of key decisions
    - Regulatory response memos
    - Legal review notes
    - Postmortem report

---

## 📚 **8. Postmortem Reporting & Prevention**

| Step | Description |
| --- | --- |
| **IR Retrospective** | Mandatory within 7 days of incident close |
| **Root Cause Analysis (RCA)** | Identify technical and procedural failures |
| **Policy Adjustment** | Update affected SOPs (IAM, access, DevSecOps) |
| **Comms Memo** | Share a plain-language summary internally (if Level 2+) |
| **Training Refresh** | Update staff training if human error involved |
| **Dashboarding** | Add incident meta to monthly security overview |

---

## 🔍 **9. Review & Simulation Cadence**

| Activity | Frequency | Owner |
| --- | --- | --- |
| **IR Playbook Review** | Quarterly | COO + CTO |
| **Tabletop Simulation (L2+)** | Bi-Annually | CTO-led |
| **Compliance Audit Alignment** | Annual | Privacy Officer |
| **IR Tracker Snapshot** | Monthly | COO |

---

## 🧾 **Linked & Supporting Artifacts**

- **IR Tracker Template (Notion)**
- **Law 25 Breach Response Guidelines**
- **Security Policy Manual**
- **IAM Access Review Log**
- **SaaS Vendor Breach Clauses Tracker**
- **Contractor Security Clauses Appendix**
- **Forensics Checklist**
- **Comms Templates – Breach Notification Drafts**
- **Nzila Audit Prep Folder (Q1 2026)**