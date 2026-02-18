# 📊 Metrics & Reporting Framework

**Owner:** Aubert

### 1. 📄 Purpose

This framework outlines how CareAI collects, stores, and utilizes **key operational metrics** for clinics, caregivers, and internal teams while maintaining **compliance with privacy laws** and ensuring **minimal identifiable exposure**.

---

### 2. 📈 Reporting Objectives

| Objective | Description |
| --- | --- |
| **Engagement Tracking** | Monitor session frequency and usage patterns |
| **Caregiver Impact** | Assess if prompts or links affect return rates |
| **Companion Efficacy** | Identify prompt types most likely to sustain activity |
| **Consent Visibility** | Report opt-in/out trends and feature usage |
| **Clinic Outcomes** | Aggregate engagement summaries per site |

---

### 3. 📊 Core Metrics Captured

| Metric | Frequency | Notes |
| --- | --- | --- |
| `sessions_per_week` | Daily roll-up | 7-day average |
| `avg_session_duration` | Daily roll-up | Mean in minutes |
| `prompt_interaction_rate` | Weekly | Tap/dismiss ratio |
| `caregiver_link_ratio` | Monthly | Linked vs unlinked |
| `consent_opt_out_rate` | Monthly | Tracked per feature |
| `clinic_activity_score` | Weekly | Aggregated streaks, sessions |

---

### 4. 🧮 Aggregation & Display

| Layer | Tool | Format |
| --- | --- | --- |
| **Backend Rollups** | SQL / Supabase Jobs | 7-day trailing cache |
| **Dashboard Tiles** | Admin UI | % or counts per metric |
| **Research Views** | Export (anonymized) | CSV + dashboard tool (Phase 3) |

---

### 5. 🔐 Privacy Safeguards

| Safeguard | Implementation |
| --- | --- |
| **No PII in Metrics** | UUID-based aggregation only |
| **Consent Gating** | No metrics pulled if user revoked consent |
| **Export Controls** | All data tagged with export flag + TTL |
| **Limited Retention** | Metrics cache cleared every 14 days (non-essential) |

---

### 6. 🔗 Linked Documents

- 📄 [Clinic Dashboard Data Pipeline Spec]
- 🧩 [Data Schema Overview]
- 📋 [Audit Logging Strategy]
- 📤 [Research Export Controls]
- ⚖️ [AI Governance & Ethics Charter]
