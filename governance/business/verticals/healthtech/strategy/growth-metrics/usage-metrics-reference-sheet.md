# 📊 Usage Metrics Reference Sheet

**Owner:** Aubert

### 📋 1. Daily Metrics Tracked per Patient

| Metric | Description | How It’s Calculated | Visibility |
| --- | --- | --- | --- |
| **Last Active Date** | Most recent day of use | Timestamp of last completed session | ✅ |
| **Sessions in Last 7 Days** | # of distinct sessions played | Count of `session_id` per user in 7-day window | ✅ |
| **Avg. Session Duration** | Avg. gameplay time per session | Mean of `end_time - start_time` across recent sessions | ✅ |
| **Streak Days** | Consecutive active days | Rolling count of back-to-back active days | ✅ |
| **Companion Status** | Whether Companion is muted | Boolean flag from user profile | ✅ |
| **Caregiver Linked** | Whether caregiver is connected | True/False flag from consent log | ✅ |
| **Consent Status** | Active or revoked consent | Status from Consent Log Table | ✅ |

---

### 🧠 2. Engagement Flags (Displayed as Icons)

| Icon | Trigger Logic | Interpretation |
| --- | --- | --- |
| 🔔 (Active Companion) | Companion not muted, 1+ sessions last 3 days | User is engaging normally |
| 🔕 (Muted) | Companion explicitly disabled by user | May indicate fatigue or preference |
| ⛔ (Consent Revoked) | User withdrew dashboard sharing | Must be hidden from clinic view |
| ⭐ (3+ Day Streak) | Played ≥3 consecutive days | High engagement trend |
| 🛑 (Inactivity Flag) | No session in past 3 days | May need encouragement (via caregiver or follow-up) |

---

### 📈 3. Weekly Dashboard Summary Tiles

| Tile Name | Metric Source | Update Frequency |
| --- | --- | --- |
| **Patients Active This Week** | Count of unique users with ≥1 session | Daily |
| **3+ Day Streaks** | Count of users with `streak_days >= 3` | Daily |
| **Caregiver-Linked Patients** | % of active users with `caregiver_linked = True` | Daily |
| **Consent Revoked** | # of patients with status = revoked | Instant |
| **Companion Mute Rate** | % of active users with Companion = muted | Daily |

---

### 🔐 4. Privacy & Interpretation Guidance

- No raw game scores, mistakes, or individual prompts are visible
- All metrics are **aggregated** and **consent-bound**
- Clinics should use flags to monitor engagement trends, not individual outcomes
- Companion behavior is user-driven and not editable by clinic staff
- All metric changes are tracked in **audit logs** for compliance

---

### 📁 Linked Resources

- Clinic Dashboard Walkthrough
- Consent Summary Sheet
- Data Schema Overview
- Clinic FAQ
- Escalation Map
