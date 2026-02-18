# 🩺 Clinic Dashboard Data Pipeline Specification

**Owner:** Aubert

### **1. Purpose**

This specification governs the design and flow of data powering Memora’s **Clinic Dashboard**, enabling authorized pilot partners to:
- Monitor patient interaction trends
- Respect data privacy and patient sovereignty
- Support aging-in-place models and memory care workflows
- Operate within Law 25 and PIPEDA compliance zones
- Avoid clinical overreach or diagnostic inferences

---

### **2. Strategic Objectives**

| Goal | Implementation |
| --- | --- |
| **Actionable summaries** | Focused metrics, not raw session logs |
| **Data minimization** | No personal health data or PII exposure |
| **Consent-governed access** | Dashboard is auto-disabled if user revokes consent |
| **Scalable pilot model** | Lightweight deployment, low IT dependency |

---

### **3. System Architecture (Textual Flow Map)**
`pgsql
CopyEdit
+------------------------+      +-----------------------+
|    Mobile App (Patient)       |  Caregiver Portal     |
| - Game sessions               | - Encouragements Sent |
| - Companion interactions      |                       |
| - Consent toggles             |                       |
+---------------|--------------+                       |
                ↓
+-------------------------------+
|     Backend Logging Layer      |
| - Session events               |
| - Consent state validation     |
| - Companion triggers           |
+---------------|--------------+
                ↓
+-------------------------------+
|   Aggregation & Signal Layer   |
| - Daily rollups (7-day lookback)
| - Streak / inactivity flags
| - Companion mute summaries
+---------------|--------------+
                ↓
+-------------------------------+
|    Clinic Dashboard View       |
| - Summary tiles                |
| - Patient row summaries        |
+-------------------------------+

`

---

### **4. Fields Visible to Clinic Admins**

| Field | Description | Visibility |
| --- | --- | --- |
| `session_count_last_7d` | Total completed sessions this week | ✅ |
| `avg_session_duration` | Engagement length per session | ✅ |
| `games_played_this_week` | Count per game type | ✅ |
| `streak_days` | Consecutive day count | ✅ |
| `last_active_date` | Last session date | ✅ |
| `companion_muted` | True/False toggle | ✅ |
| `caregiver_linked` | Indicates support structure | ✅ |
| `consent_status` | Active or Revoked | ✅ |
| `clinic_linked` | System-only field | Internal use |
| `patient_name/ID` | Omitted (anonymized row hash only) | ❌ |

---

### **5. Aggregation Logic**

| Rule | Behavior |
| --- | --- |
| **Frequency** | Aggregation runs nightly (local time) |
| **Flags Triggered If:** |  |

- No activity in past 3 days
- Companion muted
- No caregiver linked after 7 days

| **Data retention** | 7-day rolling window (MVP), expandable for pilot metrics |

---

### **6. Privacy & Security Safeguards**

| Control | Implementation |
| --- | --- |
| **PII Redaction** | No names, emails, or direct identifiers |
| **Consent Gating** | Revoking consent disables clinic dashboard linkage |
| **Role-Gated Login** | Only approved clinic admin accounts |
| **Logging** | All dashboard access logged with IP, timestamp, user role |
| **Canadian Residency** | All data stored in Canada (e.g., AWS Canada Central) |

---

### **7. Dashboard UI Tiles (MVP Targets)**

| Tile Name | Metric |
| --- | --- |
| “Active This Week” | # of users with 1+ sessions |
| “3+ Day Streaks” | # with consecutive engagement |
| “Needs Encouragement” | # with 3+ days inactivity |
| “Caregiver-Linked” | % of users with linked support |
| “Consent Revoked” | # of dashboard opt-outs |
| “Companion Muted” | % of patients in silent mode |

---

### **8. Role-Based Access Summary**

| Role | Access Level |
| --- | --- |
| **Clinic Admin** | Summary tiles + anonymized patient rows |
| **Internal Admin (audit)** | Full access with audit tagging |
| **Patient / Caregiver** | No access |
| **Researcher (future)** | Subject to anonymized export framework (Phase 3) |

---

### **9. Performance & Security Controls**

| Concern | Mitigation |
| --- | --- |
| **Latency** | Dashboard updates every 24 hours (not real-time) |
| **System Load** | Aggregates via rollup table (caching layer) |
| **Security** | All requests require valid JWT with clinic role claim |
| **Fallbacks** | If data is unavailable, UI greys out stale rows |

---

### **10. Linked Technical Documents**

- 📊 Data Schema Overview
- 🔐 Consent & Privacy Flow
- 📋 Audit Logging Strategy
- 🧠 Companion Logic Engine Spec
- 🏥 [Clinic Pilot Implementation Brief]
- 🖥️ [Dashboard UX Wireframes (Figma)]
