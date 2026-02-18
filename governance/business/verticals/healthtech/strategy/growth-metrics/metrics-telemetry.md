# 📊 Metrics & Telemetry

**Owner:** Aubert

### 1. 🎯 Purpose

This module defines how Memora’s cognitive games and Companion engine collect, tag, and relay gameplay and emotional wellness metrics in a privacy-compliant, fatigue-aware manner. It supports:
- **Companion tone and pacing calibration**
- **User behavior analytics for research or pilot evaluation**
- **Anonymized clinical reporting (if opted-in)**
- **Debugging and adaptive gameplay refinement**

---

### 2. 🧠 Tracked Metric Categories

| Category | Example Metrics | Purpose |
| --- | --- | --- |
| **Engagement** | Session start/end, time on task, number of active days | Evaluate sustainable usage |
| **Fatigue Signals** | Rest prompts accepted, delay in inputs, early exits | Companion adaptation, rest tuning |
| **Game Interaction** | Accuracy %, skips, completion %, input type | Gameplay tuning, cognitive trend mapping |
| **Emotional Check-ins** | Mood reflection prompts, journal sentiment tags | Ecosystem insight, patient/caregiver stress lens |
| **Consent & Privacy** | Scope flags, opt-in event logging | Legal compliance, user control verification |

---

### 3. 📦 Data Payload Structure
`{
  "session_id": "abc123",
  "user_id": "hashed-uid",
  "timestamp": "2025-07-01T16:32:10Z",
  "game": "memory-match",
  "metrics": {
    "accuracy": 84,
    "input_delay_ms": 1280,
    "rest_prompt_shown": true,
    "rest_accepted": false,
    "mood_label": "calm"
  },
  "scope": "clinical-optin",
  "sync_status": "synced"
}`

---

### 4. 🔄 Sync Model

| Mode | Frequency | Notes |
| --- | --- | --- |
| **Cloud Mode (Opt-in)** | Near real-time (batch) | Synced to Supabase with region tagging |
| **Tablet/Offline Mode** | Daily or session end | Encrypted cache until reconnected |
| **Caregiver Dashboard** | Summary view only | Aggregated, non-PII, filtered by sync scope |

---

### 5. 🔐 Privacy Controls

| Control | Enforcement |
| --- | --- |
| Scope-limited logs | Data tagged by consent level (`journal-only`, `clinical-optin`) |
| PII stripping | UID hashing + field masking for all gameplay logs |
| Log expiry | 30 days for non-consented users; 180 for pilot users |
| Field-level visibility | Companion and caregiver views filtered via RBAC rules |

---

### 6. 🧪 QA Criteria

| Test Case | Expected Result |
| --- | --- |
| Log generated during gameplay | Matches schema; tags applied |
| Consent revoked | Logs tagged for purge on next sync |
| High delay inputs | Companion shifts tone on next prompt |
| Dashboard drilldown | Only summary, no raw logs exposed |

---

### 7. 🔗 Linked Modules

- Game State Management
- Companion Trigger Map
- Consent-Scope Sync Logic
- Caregiver Portal UI
- Clinic Dashboard (Pilot Only)
