# 🔐 Privacy Impact Assessment (PIA) Template

**Owner:** Aubert

**Version:** 1.0

**Maintained By:** Legal & Data Governance Team

**Required For:**
- Any new data collection feature
- Clinical integrations
- Third-party data sharing or vendor onboarding
- Use of AI models that interact with user data

---

### 📘 1. Project & Owner Details

| Field | Value |
| --- | --- |
| Project Name | [Insert Name] |
| Product or Venture | [Memora / Optiva / Other] |
| Requester | [Name, Role] |
| DPO Reviewer | [Name, Role] |
| PIA Status | [Draft / In Review / Approved] |
| Date Submitted | [YYYY-MM-DD] |

---

### 🔍 2. Summary of Initiative

Provide a brief summary of what this project or feature does, and why it requires the collection or processing of personal data.

> E.g.: “Memora’s Caregiver Encouragement Tool enables linked caregivers to receive nudges to engage their matched user. It uses Companion session telemetry and stores encouragement events for reporting.”

---

### 📊 3. Data Inventory

| Data Type | Examples | Collected? | Shared? | Storage Location |
| --- | --- | --- | --- | --- |
| User Identifiers | Email, device ID, caregiver links | ✅ / ❌ | ✅ / ❌ | [e.g., Supabase CA region] |
| Health-Adjacent Data | Game session logs, prompt response time | ✅ / ❌ | ✅ / ❌ |  |
| Consent Logs | Timestamped user approvals | ✅ | ✅ (internally) |  |
| AI Inputs / Outputs | Companion prompt triggers, NLP content | ✅ / ❌ | ✅ / ❌ |  |
| Location Data | IP region (approximate) | ✅ / ❌ | ❌ |  |

---

### ⚖️ 4. Legal Basis for Collection

| Legal Justification | Applied? |
| --- | --- |
| User Consent (explicit) | ✅ / ❌ |
| Contractual Necessity | ✅ / ❌ |
| Legitimate Interest (internal use only) | ✅ / ❌ |
| Public Interest (research only) | ✅ / ❌ |

Provide a short rationale:

> “User consent is collected at onboarding, including for Companion interaction and caregiver linkage.”

---

### 🧾 5. Consent Mechanics

| Element | Mechanism |
| --- | --- |
| Consent Collection Method | [Checkbox / Toggle / Verbal / API-based] |
| Consent Interface | [Onboarding screen / Settings panel] |
| Withdrawal Mechanism | [Settings > Privacy Panel / Email support] |
| Consent Logging | [Stored in Consent Log Table with UUID & timestamp] |

---

### 🔐 6. Security & Access Controls

| Control | Status |
| --- | --- |
| Encryption (at rest / in transit) | ✅ |
| RBAC (Role-Based Access Control) | ✅ |
| Data residency (Canada) | ✅ / ❌ |
| Audit logging for sensitive views | ✅ |
| Breach response plan in place | ✅ |

---

### 📤 7. Data Sharing

| Shared With | Type | Consent Needed? | Terms in Place? |
| --- | --- | --- | --- |
| Internal Analytics | Aggregate use only | ❌ | ✅ |
| Clinical Partner | De-identified only | ✅ | ✅ (MoU or DPA) |
| Research Institution | Consent-backed cohort export | ✅ | ⏳ (IRB review) |

Attach related **DPA**, **MoU**, or **IRB memo** if applicable.

---

### 📅 8. Retention & Deletion

| Policy | Details |
| --- | --- |
| Data Retention Duration | [e.g., 2 years from session] |
| Deletion Request Handling | [30-day compliance SLA] |
| Anonymization or Pseudonymization Steps | [Hashing / tokenization for sessions, redaction of IDs] |

---

### 🧠 9. AI Use Disclosure (If Applicable)

| Model Purpose | Data Used | Human in Loop? | Explanation Mechanism |
| --- | --- | --- | --- |
| [e.g., Prompt Timing Optimizer] | Game session metadata | ✅ / ❌ | Companion shares simplified version |

---

### 📋 10. Risk Assessment & Mitigation

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Unauthorized caregiver access | Medium | Consent gating + RBAC |
| Prompt personalization revealing sensitive patterns | Low | Tone control + no emotional inference |
| Data breach | High | Encrypted infra + breach response SOP |

---

### ✅ 11. Final Approvals

| Approver | Role | Signature | Date |
| --- | --- | --- | --- |
| [Insert Name] | Legal / DPO |  |  |
| [Insert Name] | Product Owner |  |  |

---

### 📁 Attachments & Linked Docs

- [Consent & Privacy Flow Diagram]
- [Data Schema Overview]
- [Anonymization Policy]
- [DPA / IRB / Clinical MoU (if applicable)]
- [Risk Register Entry]
