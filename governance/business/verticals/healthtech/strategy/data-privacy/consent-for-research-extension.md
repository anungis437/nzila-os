# ✅ Consent for Research Extension

**Owner:** Aubert

### **1. Purpose**

This document outlines how Memora enables **legal, ethical, and clear opt-in consent** for users (patients and caregivers) who wish to participate in **research studies** beyond general app use. It defines:
- Consent structure and **UI presentation**
- **Revocation and audit logic**
- Scope of **data access under research protocols**
- Readiness for **IRB, ethics boards, and Law 25 audits**

---

### **2. Consent Types and Scope**

| Consent Type | Description | Required for Research Export |
| --- | --- | --- |
| **General use consent** | Standard app access, data storage, Companion prompts | ❌ |
| **Caregiver link consent** | Grants limited visibility to approved caregiver | ❌ |
| **Clinic dashboard consent** | Allows clinic to view engagement summaries | ❌ |
| **Research participation consent** | Grants access to non-identifiable engagement data for study use | ✅ |
| **Export consent hash inclusion** | Allows record inclusion in research-grade export with audit trail | ✅ |

---

### **3. Consent Extension UX Flow (Inline or Modal)**

| Step | Element |
| --- | --- |
| **Invite modal** | Triggered in settings or via clinic onboarding |
| **Explanation step** | “This research studies how memory-support tools are used...” |
| **Data description** | “No personal identifiers, only session activity patterns...” |
| **Revocation clause** | “You may revoke at any time from Settings” |
| **Confirmation** | Checkbox: “I consent to participate in this study” |
| **Submit** | Consent stored, logs updated, status surfaced to dashboard (if clinic-linked) |

---

### **4. Consent Logging Schema**

| Field | Description |
| --- | --- |
| `user_id` | Pseudonymized UUID |
| `consent_type` | `research_participation` |
| `status` | `granted` / `revoked` |
| `timestamp` | UTC |
| `by_user` | `true` if manually revoked |
| `study_id` | Optional tag for cohort mapping |
| `export_flag` | Boolean indicating eligibility for export |

---

### **5. Revocation Logic**

| Action | Result |
| --- | --- |
| User toggles off research consent | Flag removed, user excluded from future exports |
| Revocation audit | Logged and timestamped, stored in Consent Log Table |
| Dashboard reflection | Clinic view updated to “Not participating” (soft label) |
| Export retroactivity | Past exports are not recalled; future exports are blocked |

---

### **6. Edge Case Handling**

| Case | Behavior |
| --- | --- |
| User deletes account | Data is removed; study flags invalidated |
| Caregiver consents but patient doesn’t | Caregiver’s data excluded; no linkage logs created |
| Research consent revoked mid-study | Status updated; future exports respect revocation |
| User consents, but dashboard consent revoked | Dashboard metrics excluded, session data remains eligible (anonymized) |

---

### **7. Language, Accessibility & Compliance Alignment**

| Area | Implementation |
| --- | --- |
| **Bilingual consent screen** | EN/FR version, tone-matched and pre-approved by legal |
| **Consent info sheet (external)** | Optional PDF for clinics or IRB with plain-language summary |
| **WCAG compliance** | Keyboard-accessible, focus indicators, screen-reader tagged |
| **Law 25 alignment** | Explicit purpose consent, data residency, revocation enforcement |
| **GDPR mapping** | Optional consent-for-export flag mirrors Article 6 lawful basis tracking |

---

### **8. Consent Decay & Reconfirmation (Optional, Phase 3)**

| Feature | Status |
| --- | --- |
| Annual reconfirmation prompt | Planned |
| Triggered reconfirmation (study updated) | Planned |
| Passive consent refresh (no action) | ❌ Not allowed under Law 25 or GDPR |

---

### **9. Audit Export Readiness**

- Export header includes:
- `consent_type = research_participation`
- `consent_timestamp`
- `study_id` (if tagged)
- `consent_hash` (SHA-256)
- Logs retrievable for audit up to **5 years**

---

### **10. Linked Documents**

- 📋 [Consent & Privacy Flow]
- 📤 [Pilot Data Export Specification]
- 🧪 [Anonymization & Data Lifecycle Policy]
- 🧠 [Behavioral Change Theory of Use]
- 🧭 [Study Participation UX Patterns]
- 🧱 [Audit Logging Strategy]
