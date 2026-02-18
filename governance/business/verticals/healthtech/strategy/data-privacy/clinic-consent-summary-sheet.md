# 📘 Clinic Consent Summary Sheet

**Owner:** Aubert

### ✅ 1. What Patients Consent To

When a patient sets up their account in Memora, they must provide **explicit, affirmatively recorded consent** for:

| Consent Area | What It Enables |
| --- | --- |
| **Use of Memora App** | Engage with games and receive Companion prompts |
| **Companion Prompts** | Daily encouragement messages and nudge notifications |
| **Clinic Visibility** | Allows their clinic to see **summary-level engagement data** (never gameplay content) |
| **Optional Caregiver Link** | Enables a trusted caregiver to view routine summaries |
| **Anonymized Data for Research** | Allows use of behavioral trends (e.g. session timing) in de-identified research |

All consents are time-stamped, role-scoped, and **revocable at any time** by the patient.

---

### 👁️ 2. What Clinics Can See

Clinics **only see the following** fields for each patient with active consent:

| Field | Example | Notes |
| --- | --- | --- |
| **Patient Alias** | “User A123” | Never a real name or email |
| **Last Active Date** | “Sept 28” | Based on most recent session |
| **Streak Days** | “4 days in a row” | Counts consecutive sessions |
| **Average Session Time** | “6.2 mins” | Rolling 7-day average |
| **Companion Status** | “Muted / Active” | Displays mute flag |
| **Caregiver Linked** | “Yes / No” | Shows if caregiver is linked |
| **Consent Status** | “Active / Revoked” | Determines if row is visible |

> 🔒 Clinics never see: exact game scores, answers, health history, or Companion prompt content.

---

### 🛑 3. What Happens When Consent Is Revoked

If a patient revokes consent for clinic visibility:
- Their row **immediately disappears** from the clinic dashboard
- Their **historic data becomes inaccessible** to clinic staff
- Audit logs record the revocation with a timestamp
- Patients can re-enable consent later if desired

> Clinics are advised not to export, save, or screenshot any dashboard content after revocation.

---

### 🔁 4. Consent Lifecycle (Simplified Flow)
`[Patient Opens App]
     ↓
[Accepts Consent Terms]
     ↓
[Clinic Dashboard View Enabled]
     ↓
[Patient Revokes Consent?] → [Yes] → [Dashboard Row Hidden]
                                 ↓
                                [Re-enable?] → [Dashboard View Restored]

`

---

### ⚖️ 5. Compliance Summary

| Principle | Memora Implementation |
| --- | --- |
| **Explicit Consent** | No access granted without active patient agreement |
| **Revocability** | Patients can opt out anytime |
| **Audit Logging** | All consent events time-stamped and role-tracked |
| **Data Minimization** | Clinics only see preapproved summary data |
| **Jurisdictional Storage** | Data hosted in Canadian infrastructure (Law 25–ready) |

---

### 📁 Linked Resources

- Consent & Privacy Flow
- Data Schema Overview
- Clinic Dashboard Walkthrough
- Caregiver Visibility Controls
- Audit Logging Strategy
