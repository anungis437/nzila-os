# 🔐 Vendor Security Review SOP

Owner: Aubert

**Version:** 1.0

**Maintained By:** Privacy Officer + CTO

**Review Cycle:** Annually, or upon onboarding of new critical vendor

**Last Updated:** [Insert Date]

---

## 🧭 1. Purpose

To standardize the process by which Nzila Ventures evaluates, approves, and monitors third-party vendors (including SaaS tools, contractors, infrastructure providers, and service integrators) with access to sensitive systems or data. This SOP mitigates legal, operational, and reputational risk by ensuring all vendors meet minimum security, privacy, and contractual requirements.

---

## 📦 2. Scope

Applies to:

- All **third-party tools and platforms** that store, transmit, or process Nzila data
- **Contractors** or service providers with access to sensitive systems or production environments
- Any external parties handling **personal health information (PHI)**, **personally identifiable information (PII)**, or **behavioral data**
- Vendors used in **product delivery, customer support, infrastructure, analytics, or R&D**

---

## 🧱 3. Review Tiers

| Tier | Description | Examples | Review Depth |
| --- | --- | --- | --- |
| **Tier 1 – Critical** | Direct access to PHI/PII or infrastructure | Supabase, GitHub, Azure, Interpodia | Full review (SOC2 + DPIA) |
| **Tier 2 – Operational** | Business ops + metadata access only | Notion, Slack, Google Drive | Lightweight review |
| **Tier 3 – Informational** | No access to sensitive data | Canva, Loom, Calendly | Security self-attest |

---

## 🔍 4. Review Process Flow

| Step | Description | Owner | Output |
| --- | --- | --- | --- |
| **1. Initiation** | New vendor request initiated | Department Lead | Vendor Intake Form |
| **2. Classification** | Assign tier based on data access | Privacy Officer | Tier label |
| **3. Security Documentation Review** | Evaluate vendor-provided SOC 2, ISO 27001, or equivalent | CTO + Privacy Officer | Security Review Checklist |
| **4. Privacy & Compliance Check** | Ensure Law 25/PIPEDA/HIPAA alignment | Privacy Officer | DPIA (if Tier 1) |
| **5. Contractual Review** | Validate DPA, indemnity clauses, breach notice SLA | Legal | Signed contract or redlines |
| **6. Approval** | Internal sign-off | COO | Vendor Approved Log entry |
| **7. Onboarding Controls** | IAM setup, 2FA, access scoping, NDA collection | IT + Ops | Vendor Access Tracker |
| **8. Monitoring** | Track breach disclosures, status changes, or data incidents | Privacy Officer | Quarterly Security Snapshot |

---

## 📁 5. Documentation Requirements by Tier

| Document | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- |
| Security Questionnaire | ✅ Required | ✅ Optional | ❌ |
| SOC 2 / ISO 27001 Report | ✅ Preferred | ❌ | ❌ |
| Data Protection Agreement (DPA) | ✅ Required | ✅ Optional | ❌ |
| Law 25 Attestation | ✅ Required | ✅ Preferred | ❌ |
| Breach Notification SLA | ✅ Required | ✅ Recommended | ❌ |
| NDA / Confidentiality Agreement | ✅ Required | ✅ Required | ✅ Optional |
| DPIA (if handling PHI) | ✅ Required | ❌ | ❌ |

---

## ⚠️ 6. Minimum Security Controls (Tier 1 Vendors)

- End-to-end encryption (in transit + at rest)
- Multi-factor authentication (MFA)
- Role-based access controls (RBAC)
- Audit logs and access tracking
- Breach notification within 72 hours (Law 25/PIPEDA)
- DPA + indemnification clause in contract

---

## 🛠️ 7. Tools Used

| Tool | Use |
| --- | --- |
| **Vendor Intake Form (Notion or Forms)** | Captures request and details |
| **Vendor Review Tracker (Notion)** | Central dashboard for all vendors |
| **Security Review Checklist (PDF/Docx)** | Formal review record |
| **DPIA Template** | Applied to Tier 1 vendors |
| **Contract Repository (Google Drive)** | Final signed contracts, DPAs |
| **SaaS Access Tracker** | Monthly review of user/vendor permissions |
| **Slack #ops-sync or #security** | Escalation and communication during reviews |

---

## 🧮 8. Governance & Audit Readiness

- **Quarterly Vendor Review Snapshot** prepared by Privacy Officer and shared with leadership
- **Annual Vendor Audit** to re-certify Tier 1 vendor status
- **Exit Checklist** for terminated vendors: system access revoked, data deleted/exported, NDA enforcement

---

## 📎 Linked Artifacts

- Vendor Intake Form Template
- DPIA Template (Law 25-ready)
- Security Review Checklist (SOC2-aligned)
- Legal Boilerplate: Data Processing Addendum (DPA)
- SaaS Access & Offboarding Tracker
- Quarterly Risk Review Dashboard