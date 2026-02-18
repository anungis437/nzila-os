# 🖥️ Clinic Dashboard Walkthrough

**Owner:** Aubert

### 🧭 1. Dashboard Overview

> Access Point: dashboard.memora.clinic

**Login Method:** Email + Password (via secure invite)

**Roles Supported:** Admin / Viewer

**Main View Layout:**
- Patient Rows (one per enrolled patient)
- Summary Tiles at top (e.g., “3+ Day Streaks”, “Caregiver Linked”)
- Filter Controls (language, Companion status, activity)

---

### 👁️ 2. Patient Row Fields

| Field | Description |
| --- | --- |
| **Patient ID** | Pseudonymized display (e.g., "User A23") |
| **Last Active Date** | Most recent session completed |
| **Streak Days** | Consecutive days with game activity |
| **Avg. Session Time** | Rolling 7-day average (minutes) |
| **Caregiver Linked** | ✅ if a caregiver is actively connected |
| **Companion Status** | Shows if Companion is muted or active |
| **Consent Status** | Green = active / Red = revoked |

---

### 🛠️ 3. Admin Functions

> Only visible to users with Admin role

| Function | Description |
| --- | --- |
| **Add/Remove Clinic Users** | Invite or deactivate staff accounts |
| **Export Report (PDF)** | Download usage summaries for internal review |
| **Manage Filters** | View all or only active/inactive users |
| **Flag Issue** | Internal note visible to Memora team (Phase 2) |

---

### 🔕 4. Understanding Companion Status Indicators

| Icon | Meaning |
| --- | --- |
| 🔔 | Companion is active and delivering prompts |
| 🔕 | Companion has been muted by the user |
| ⛔ | Companion is inactive due to revoked consent |

> Companion status is always read-only for clinics

---

### 📋 5. Summary Tiles (Top of Dashboard)

| Tile | Description |
| --- | --- |
| **Patients Active This Week** | Count of users with ≥1 session |
| **3+ Day Streaks** | Motivational engagement indicator |
| **Caregiver-Linked Patients** | Percent of users with caregiver support |
| **Consent Revoked** | Red flag for users opting out of data sharing |
| **Companion Mute Rate** | Percent of users who disabled prompts |

---

### 🔐 6. Privacy-Safe Design Principles

- No identifiable patient data (names, photos, contact info)
- Only engagement signals are shown
- All views governed by **consent and data role policies**
- Logs are retained for 12 months for audit purposes
- Dashboard automatically hides patients who withdraw consent

---

### 📁 Linked Materials

- Account Setup & Role Access Guide
- Consent Summary Sheet
- Clinic Onboarding Checklist
- Law 25 / PIPEDA Memo
- Support Escalation Map
