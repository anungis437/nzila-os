# 🛡️ Consent & Privacy Flow

**Owner:** Aubert

### **1. Purpose**

This document outlines how Memora enforces a **consent-centric system architecture**, ensuring:
- Explicit opt-in before any personal or behavioral data is stored or exposed
- Traceable audit trails for all sensitive relationships (caregiver, clinic, Companion)
- Reversible access with **zero penalty** and full transparency
- Full legal alignment with **Quebec’s Law 25**, **PIPEDA**, and **GDPR-compliant** models for future research partnerships

---

### **2. Consent Touchpoints (MVP Scope)**

| Consent Type | Description | Trigger |
| --- | --- | --- |
| **Data Storage + Interaction Logging** | Core legal consent for account creation, Companion usage | Required at onboarding |
| **Companion Interactions** | Allows in-app nudges and tone-adjusted messaging | Optional; toggle-based |
| **Caregiver Linkage** | Authorizes dashboard viewing and encouragement triggers | Patient-initiated; revocable anytime |
| **Clinic Access Acknowledgment** | Enables view-only dashboards at pilot clinics | Displayed if user onboarded via clinic |
| **Anonymized Research Use** | Allows usage data (de-identified) to be included in research exports | Optional during onboarding and settings |
| **Deletion / Right to Erasure** | Full data wipe of account and logs | User-initiated via Privacy Settings |

---

### **3. Consent Flow Diagram (Text Representation)**
`scss
CopyEdit
[ App Launch ]
    ↓
[ Account Creation ]
    ↓
[ Consent A: Data Storage & Telemetry Logging ] (Required)
    ↓
[ Consent B: Companion Interactions ] (Optional – toggle enabled)
    ↓
[ Consent C: Clinic Data View ] (Only if clinic ID present at onboarding)
    ↓
[ Welcome Completed ]
    ↓
[ Optional: Link Caregiver ]
        ↓
  [ Consent D: Caregiver Visibility ]
    - Summary-only access
    - Revocable anytime via Settings
    ↓
[ Routine Use: Companion + Games + Dashboard ]
    ↓
[ Consent Log Updated ]
    ↓
[ Privacy Controls Panel ]
  → View logs, revoke access, disable Companion, delete account

`

---

### **4. Revocation Protocols**

| Revocation Type | Result |
| --- | --- |
| **Caregiver Link** | Immediate unlink; dashboard deactivated |
| **Companion Nudges** | Companion enters silent mode; no prompts |
| **Clinic Visibility** | Data removed from clinic dashboard |
| **Research Consent** | Flagged for exclusion from future exports |
| **Account Deletion** | Triggers full data anonymization protocol (session, Companion, logs) |

---

### **5. Consent Logging & Audit Trail**

| Log Event | Captured Fields |
| --- | --- |
| `consent_given` | `user_id`, `consent_type`, `language`, `timestamp` |
| `consent_revoked` | `user_id`, `revocation_type`, `interface_used`, `timestamp` |
| `external_view` (clinic/caregiver) | `viewer_role`, `user_id`, `access_scope`, `timestamp`, `log_hash` |

Logs are stored in the **Consent Ledger Table**, isolated from primary session/game data.

---

### **6. Accessibility, Language, and Ethical Protections**

- **Bilingual display**: All consent screens available in French and English
- **No dark patterns**: All options clearly surfaced, with toggles and plain-language “Learn More” links
- **Affirmative consent only**: No pre-checked boxes or silent opt-ins
- **Granular control**: Companion, caregiver, and clinic consents can be individually managed
- **Revocation-neutral**: Opting out never limits gameplay or access to resources

---

### **7. Legal Framework Alignment**

| Framework | Compliance Elements |
| --- | --- |
| **Law 25 (Quebec)** | Purpose-based consent, audit logs, local storage, revocation UX |
| **PIPEDA (Canada)** | Right to access and correction, breach response ready, use transparency |
| **GDPR (EU alignment for research)** | Data portability, pseudonymization, right to erasure (Article 17) |

---

### **8. Linked System Documents**

- 🔐 Auth & Permissions Model
- 📊 Data Schema Overview
- ⚖️ [Privacy Policy (MVP Legal)]
- 🧼 [Anonymization & Deletion Protocol]
- 🏥 [Clinic Dashboard Access Controls]
- 📋 [Audit Logging Strategy]
