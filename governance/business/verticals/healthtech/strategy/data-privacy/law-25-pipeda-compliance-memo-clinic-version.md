# 🛡️ Law 25 & PIPEDA Compliance Memo (Clinic Version)

**Owner:** Aubert

### 🇨🇦 1. Overview of Applicable Laws

| Law | Scope | Applies To |
| --- | --- | --- |
| **Law 25** (Quebec) | Governs privacy rights, data localization, and consent requirements for Quebec-based individuals | All Quebec-based patients and clinics |
| **PIPEDA** (Canada) | National personal data protection law for private sector entities | All clinics operating outside of Quebec or interacting with Canadian citizens |

---

### 🔐 2. Memora’s Compliance Framework

| Requirement | Law 25 | PIPEDA | Memora Implementation |
| --- | --- | --- | --- |
| **Explicit Consent** | ✅ Required | ✅ Required | All user data sharing (clinic or caregiver) is opt-in, purpose-specific, and logged |
| **Right to Revoke Consent** | ✅ | ✅ | Patients can revoke visibility from clinics or caregivers any time in the app |
| **Transparency of Use** | ✅ | ✅ | Companion and dashboard explain how data is used and by whom |
| **Access Controls** | ✅ | ✅ | Role-based access (RBAC) strictly limits visibility |
| **Audit Logging** | ✅ | ✅ | All consent, access, and session events are time-stamped and retained |
| **Data Residency** | ✅ Must be in Quebec or Canada | Recommended | All data stored in Canadian cloud infrastructure (Quebec-ready) |
| **PII Protection** | ✅ | ✅ | No names, emails, or health records shown to clinics |
| **Data Minimization** | ✅ | ✅ | Clinics receive only engagement metadata, not content or scores |

---

### 👁️ 3. What Clinics Must Know

**You will never see:**
- Patient names, emails, or identifiers
- Game answers or performance scores
- Companion prompt contents
- Health records or diagnostics

**You will see:**
- Anonymized patient rows (e.g., “User A1”)
- Session streaks, last played date
- Whether Companion is muted
- Whether caregiver is linked
- Consent status (Active / Revoked)

**What you must not do:**
- Export, print, or screenshot dashboard content outside approved use
- Share dashboard credentials
- Attempt to deanonymize user records
- Continue accessing a patient’s record after consent is revoked

---

### 🧾 4. Clinic Responsibilities

| Responsibility | Description |
| --- | --- |
| **Role Management** | Maintain only necessary access to dashboard users |
| **Consent Awareness** | Do not assume visibility = permission; always confirm consent is active |
| **Training Compliance** | Ensure all clinic staff using the dashboard have reviewed onboarding & privacy docs |
| **Escalation Protocols** | Report any accidental access or misuse to Memora’s Privacy Officer immediately |
| **Data Handling** | Do not store or copy pilot data outside of the Memora environment |

---

### 🧠 5. Resources for Clinic Staff

- 📘 [Consent Summary Sheet (Clinic-Facing)]
- 🧭 [Data View & Consent Boundaries]
- 🔍 [Audit Logging FAQ]
- 🗂️ [Clinic Dashboard Walkthrough]
- 🔒 [Privacy Policy (Clinic-Facing)]
- 🧾 [Pilot Terms of Use – Clinic Version]

---

### 📮 Contact Information

| Role | Contact | Email |
| --- | --- | --- |
| **Privacy Officer** | [Insert Name] | privacy@memora.clinic |
| **Support Team** | — | support@memora.clinic |
| **Partnership Lead** | [Insert Name] | clinics@memora.clinic |
