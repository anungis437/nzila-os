# 🧾 Memory Erasure Request Tracker & Compliance Flow

**Owner:** Aubert

Memora’s Companion is built on **consent-based memory**. This module ensures that users, caregivers, or field teams can trigger **secure, auditable memory erasure** — in full alignment with privacy frameworks like **GDPR**, **Law 25 (QC)**, and **Nzila’s Ethical AI Charter** — whether online or in offline-first field deployments.

---

## 🎯 Purpose

- Uphold the right to be forgotten, in child- and caregiver-centric deployments
- Offer **manual and digital pathways** for memory deletion, even in disconnected zones
- Maintain **auditability** of all deletion events without retaining sensitive data
- Support **granular control** (e.g. reflection-only wipe, full memory erasure)
- Respect dignity, trauma healing, and program exit boundaries

---

## 🧾 Valid Erasure Request Sources

| Source | Authentication |
| --- | --- |
| 🧑 User (age-appropriate) | In-device prompt + optional PIN |
| 👪 Caregiver / Guardian | Consent form or device app confirmation |
| 🧑‍⚕️ NGO / Field Staff | QR or printed memory deletion form |
| 🧑‍🏫 Program Coordinator | Only when user is unreachable (must be logged) |

---

## 🔐 Types of Erasure

| Type | Scope | Use Case |
| --- | --- | --- |
| 🧼 **Full Memory Wipe** | Deletes all reflection logs, prompt interaction history, tone evolution | Graduation, opt-out, trauma response |
| 🪶 **Reflection-Only Erasure** | Clears mood entries, journaling, story responses | Privacy reset, caregiver concern |
| 🔘 **Toggle Reset** | Clears history of memory on/off actions | Restarts consent cycle |
| 🧩 **Partial Topic Deletion** | Removes specific reflection categories (e.g., “school,” “family”) | Trigger response or topic misalignment |
| 🔒 **Lock & Archive** | Encrypts data locally, disables Companion access | Field-only holding state before deletion decision |

---

## 🧭 Erasure Request Flow

1. **Request Triggered**

↳ User, caregiver, or staff initiates from app, paper form, or QR
1. **Consent Verification**

↳ PIN, paper signature, or caregiver co-confirmation
1. **Audit Log Created**

↳ Unique Erasure Event ID tied to Device ID
1. **Memory Scope Selected**

↳ Dropdown or checkbox menu for erasure type
1. **Companion Confirmation Script**

↳ “I understand. We’ll forget this together now.”
1. **Execution + Compliance Log**

↳ Memory layer cleared, and Erasure Log written (non-sensitive metadata only)
1. **(Optional) Export Before Wipe**

↳ User/caregiver may export memory summary before deletion

---

## 📋 Tracker Log Structure

| Field | Description |
| --- | --- |
| Event ID | Auto-generated, traceable only internally |
| Device ID | Unique per deployment |
| Request Source | User / Caregiver / NGO / Admin |
| Type of Erasure | Full / Reflection-Only / Partial / Archive |
| Timestamp (UTC + Local) | Required |
| Consent Method | PIN / Signature / Verbal in field |
| Export Option Used | Yes / No |
| Companion Version | For QA compatibility |
| Field Notes (optional) | For NGO or clinic use |

> 🛑 No reflection content or tone data is stored in the Tracker Log. Only action metadata.

---

## 🛠 Tools & Templates

- 📄 **Offline Memory Erasure Form** (fillable + print-safe)
- 📱 **In-App Request UI Block** (child-safe, optional PIN)
- 🔏 **Archive Toggle Button** (for field-safe holding state)
- 📊 **Compliance Dashboard Embed** (for NGO HQ)
- 📋 **Rotation & Erasure Combined Log Format**
- 🧠 **Companion Consent Language Pack** (for confirmation UX)
- 📦 **Export + Erase UX Flow** (PDF + deletion confirmation)

---

## 🧑‍⚖️ Legal & Ethical Compliance

| Framework | Compliance Notes |
| --- | --- |
| **GDPR / Law 25** | Memory logs fully erasable, no unconsented biometric storage |
| **Nzila Ethical AI** | User memory never retained without opt-in + audit trail |
| **Child Protection Protocols** | Erasure can be supervised by caregiver or staff only |
| **Trauma-Informed AI** | Companion never questions the reason for deletion |
| **Offline-First Ethics** | Field form equivalent always available in paper or QR code |

---

## 🧘 Companion UX Sample Script (Erasure)

> “Okay. We’ll let this go together now.”

“I’ll forget what we talked about. And I won’t remember it next time.”

“You can always start fresh.”

---

## ✅ Best Practices Summary

| Practice | Status |
| --- | --- |
| Companion UX avoids guilt, shame, or “are you sure?” loops | ✅ |
| All erasures are final, with backup export optional | ✅ |
| No erasure request is logged without audit consent | ✅ |
| Re-entry ID (if desired) stored separately from reflection memory | ✅ |
| All deletion forms multilingual and printable | ✅ |
