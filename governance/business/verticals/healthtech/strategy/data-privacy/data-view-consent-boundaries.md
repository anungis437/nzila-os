# 🔐 Data View & Consent Boundaries

**Owner:** Aubert

### 🧭 1. Consent Is the Gatekeeper

Memora enforces **explicit, revocable, and timestamped consent** across all relationships.

Access to **any user-linked data** is governed by the following:

| Relationship | Consent Required? | Can Be Revoked? | Logged? |
| --- | --- | --- | --- |
| Clinic → Patient | ✅ | ✅ Anytime by patient | ✅ |
| Caregiver → Patient | ✅ (initiated by patient) | ✅ Anytime by patient | ✅ |
| Internal Admin → Patient | ✅ (tagged access) | ❌ (admin logs required) | ✅ |

---

### 👁️ 2. What Clinics Can View

| Data Category | Field Examples | Viewable by Clinic? | Notes |
| --- | --- | --- | --- |
| **Engagement Metadata** | Last active, streak days, Companion status | ✅ | Consent required |
| **Caregiver Link Status** | Boolean (linked/unlinked) | ✅ | No caregiver details shown |
| **Anonymized Activity Trends** | Daily/weekly engagement summaries | ✅ | Used for pilot evaluation |
| **Consent Status** | Active / Revoked | ✅ | Controls dashboard visibility |
| **PII (Name, Email)** | Any identifying patient info | ❌ | Never shown |
| **Game-Level Detail** | Accuracy, scores, exact answers | ❌ | Not stored or shared |
| **Companion Prompts** | Specific dialogue content | ❌ | Not clinic-visible |

---

### 🙈 3. When Consent Is Revoked

When a patient **revokes consent**, the following actions are triggered:
- Patient disappears from the clinic dashboard
- A **“Consent Revoked”** flag appears in audit trail
- Clinic loses access to all linked activity, even historical
- Patient retains access to their account unless deleted
- No notifications are sent to caregiver or clinic — patient remains in control

---

### 🧠 4. Role-Based Data Visibility Matrix

| Data Element | Patient | Caregiver | Clinic Admin/Viewer | Internal Admin |
| --- | --- | --- | --- | --- |
| View own streak/activity | ✅ | ✅ (linked only) | ✅ (summary only) | ✅ |
| See Companion mute status | ✅ | ✅ | ✅ | ✅ |
| Read Companion prompt logs | ✅ | ❌ | ❌ | ✅ (tagged only) |
| Modify consent links | ✅ | ❌ | ❌ | ✅ (system override only) |
| View personal identifiers | ✅ | ✅ | ❌ | ✅ (support role only) |

---

### 🛡️ 5. Law 25 & PIPEDA Alignment Summary

| Requirement | Memora Implementation |
| --- | --- |
| **Explicit consent by relationship** | Patient must approve each link |
| **Data minimization** | Clinics receive summaries, not raw data |
| **Right to withdraw** | Available at any time via Settings |
| **Audit logs** | All accesses, consents, revocations logged |
| **Localized storage** | Canadian infrastructure (Quebec compliant) |
| **User visibility** | Patients can view who has access to their data |

---

### 📁 Linked References

- Consent & Privacy Flow
- Data Schema Overview
- Auth & Permissions Model
- Clinic Dashboard Walkthrough
- Consent Summary Sheet (Clinic + Patient)
