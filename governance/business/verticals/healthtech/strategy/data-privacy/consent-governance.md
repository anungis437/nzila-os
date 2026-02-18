# 📚 Consent & Governance

**Owner:** Aubert

### 1. 🎯 Purpose

This segment governs how Memora collects, manages, enforces, and audits user consent across all touchpoints — ensuring trust, transparency, and compliance with global privacy standards (Law 25, PIPEDA, GDPR).

It powers our ability to:
- Respect user choice at every level of interaction
- Enable fine-grained data handling based on consent scope
- Deliver real-time auditability for clinics, caregivers, and researchers

---

### 2. 🧱 Core Submodules

| Module | Description |
| --- | --- |
| **Consent Flow Logic** | Defines how consent is captured, structured, revoked, and validated session-wide |
| **Privacy & Consent Infrastructure** | Backend enforcement layer — ledger storage, API enforcement, jurisdictional mapping |
| **Consent Audit & Reporting Tools** | Internal + external tools to review, export, and validate consent lifecycle actions |

---

### 3. 🔐 Design Principles

- **Consent-First by Architecture**: All features and APIs check for consent before activating
- **Reversible by Default**: Every consent type can be revoked, including Companion memory
- **Transparent & Traceable**: Users can view, export, and manage their consent history in-app
- **Jurisdiction-Aware**: Quebec and EU logic handled locally with isolated enforcement wrappers

---

### 4. 🧭 Supported Consent Scopes

| Scope | Capabilities Enabled |
| --- | --- |
| **Basic Use** | Local memory only; no cloud sync or journaling |
| **Full Consent** | Journaling, Companion persistence, fatigue analytics |
| **Caregiver Linked** | Shared view of rest, emotional tone, and summary reflections |
| **Research Opt-In** | Anonymized, non-identifiable export into research dataset |

---

### 5. 🔄 Lifecycle Management

- Timestamped events stored in **Consent Ledger**
- Session scope applied in real time to **Sync**, **Companion**, and **Dashboard** modules
- Audit logs generated for toggles, revocations, exports, and data purges

---

### 6. 🧪 Integrated QA

| Test Suite | Focus |
| --- | --- |
| **Schema Validator** | Ensures fields are correctly mapped to consent scope |
| **Redaction Simulator** | Flags unexpected visibility after revocation |
| **Consent Re-entry Test** | Re-onboarding after revoke creates clean scope and logs |

---

### 7. 📌 Downstream Dependencies

- Cloud Sync Layer
- Companion Logic Engine
- Reflection Journaling Module
- Clinical Dashboard (for shared access controls)
- Anonymization Bridge
- Audit Logging & Reporting Infrastructure
- 📝 Consent Flow Logic
- 🛡️ Privacy & Consent Infrastructure
- 📊 Consent Audit & Reporting Tools
