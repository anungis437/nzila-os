# 📊 Shared Care Analytics Snapshot

**Owner:** Aubert

### **1. Purpose**

This document outlines the **standardized data points, aggregation logic, and visibility rules** used in Memora's **Shared Care Dashboard** for caregivers and clinics. It ensures analytics:
- Support **non-judgmental encouragement** (not performance tracking)
- Reflect only **consented, anonymized, and high-signal events**
- Are **auditable**, **bilingual**, and **fatigue-aware**
- Reinforce Memora’s philosophy of **safe, human-centered engagement**

---

### **2. Analytics Summary Tiles (Caregiver View)**

| Tile | Description | Visibility Rule |
| --- | --- | --- |
| **Active This Week** | Whether the patient opened the app at least once | ✅ `caregiver_linked = true` |
| **Companion Status** | Current state (`warm`, `neutral`, `gentle`, `silent`) | ✅ Shown if not muted |
| **Encouragement Sent** | When the last message was shared | ✅ Timestamp only; no content |
| **Care Link Health** | "All Good", "Muted", or "Disconnected" | ✅ Companion-controlled |
| **Shared Moments** | Count of shared sessions (if opt-in) | ✅ Only if `prompt_sharing_opt_in = true` |

---

### **3. Analytics Summary Tiles (Clinic View)**

| Tile | Description | Aggregation Logic |
| --- | --- | --- |
| **Patients Active This Week** | Unique users with sessions in last 7 days | De-identified, count only |
| **Avg. Session Duration** | Mean of valid sessions (>60 sec) | Rounded to 0.1 min |
| **Companion Muted Rate** | % of patients with Silent Mode active | Excludes resets |
| **Caregiver Link Rate** | % of users with approved caregiver connections | Consent-gated |
| **Daily Prompt Rate** | Avg. # of Companion prompts per user | Excludes suppressed |

---

### **4. Data Definitions**

| Metric | Definition | Safeguard |
| --- | --- | --- |
| **Session** | 1+ minute of active use | Filtered via QA logic |
| **Prompt** | Logged delivery of a Companion message | Must be viewed |
| **Shared Session** | Marked via opt-in toggle post-play | Must be confirmed by patient |
| **Care Link Status** | Computed from consent + mute + unlink flags | No reverse inference allowed |

---

### **5. Multilingual & Equity Adjustments**

- All tiles validated in **English and French**, localized by design
- No performance language used (e.g., "score", "leaderboard")
- Time-based visuals default to **calendar-neutral views**
- Charts use **color + shape** to meet accessibility needs
- All feedback copy written at **Grade 6 reading level or below**

---

### **6. Visibility Scenarios**

| Scenario | Caregiver | Clinic |
| --- | --- | --- |
| Companion muted | “Care paused” badge | Excluded from engagement counts |
| Consent revoked | All tiles hidden | User removed from clinic dashboard |
| Reset triggered | Companion tile shows “Reset active” | Data excluded from 7-day averages |
| Low activity (1 session/week) | “Low activity this week” | Included in totals but not graphed individually |

---

### **7. Compliance & Logging**

| Event | Log Contents |
| --- | --- |
| Tile view | user_id, dashboard_id, tile_id, timestamp |
| Data export (clinic only) | range, initiator, anonymization flag |
| Consent state change | user_id, affected dashboards, new scope |
| Reset + mute | Session tags added for exclusion logic |

---

### **8. Future Enhancements (Phase 2+)**

| Planned Metric | Notes |
| --- | --- |
| **Streak Trends** | Show 3-week consistency graph |
| **Fatigue Index** | Based on high dismissal/low duration ratio |
| **Caregiver Sentiment Tags** | Phase 3: caregiver chooses tone (e.g., “supportive”, “joyful”) |

---

### **9. Governance Links**

- ✅ [Dashboard Access Rules]
- ✅ [Consent & Privacy Flow]
- ✅ [Prompt Library]
- ✅ [Caregiver UX Overview]
- ✅ [Companion Behavioral System]
- ✅ [Audit Logging Strategy]
