# 📡 Connectivity Flags & Offline Survival Protocols Matrix

**Owner:** Aubert

This framework defines how Memora **detects**, **adapts to**, and **survives** periods of limited or no internet access across clinics, homes, and field deployments. It governs fallback behaviors for **memory, consent, safeguarding, syncing, and content delivery**, ensuring no user is left unsupported due to bandwidth barriers.

---

## 🎯 Key Goals

- Maintain **core Companion functionality** with no dependency on active connectivity
- Provide **local-only fallback protocols** for consent, memory handling, and device logs
- Prevent **data leakage**, **reflection loss**, or **tone misalignment** during sync gaps
- Create trust with users and caregivers through **transparent fallback messaging**
- Enable **NGOs and field staff** to administer kits safely and ethically offline

---

## 🧠 Core Offline Resilience Zones

| Zone | Offline Behavior |
| --- | --- |
| 🧾 **Consent Management** | Paper-based or QR fallback, local log capture, renewal reminders shown |
| 🧠 **Companion Prompts** | Preloaded multilingual libraries + randomized reflective bundles |
| 💬 **Tone Shifts** | Triggered by local input (mood detection, fatigue events), no cloud needed |
| 🔒 **Memory Storage** | Local encryption, no cloud dependency, time-bounded retention |
| 📦 **Kit Rotation & Sanitation Logs** | QR sheet scan or written log synced later |
| 📋 **Audit Trails** | Append-only local log; synced to cloud when restored |
| ⚠️ **Safeguarding Flags** | Logged locally with user hash + GPS stub; escalation via SMS or post-sync |

---

## 🟡 Connectivity Status Flags (Device-Level)

| Flag | Description | Companion Behavior |
| --- | --- | --- |
| 🟢 **Online (Synced)** | Full connection + cloud access | Normal ops, log sync every 15 min |
| 🟡 **Online (Limited)** | Poor bandwidth, no sync | Delay sync, cache actions locally |
| 🟠 **Offline (Recent Sync)** | Disconnected <72h | Operate with full local functionality |
| 🔴 **Offline (Extended)** | Disconnected >72h | Enter **Survival Mode**: no new memory retention, simplified UI |
| ⚫ **Isolated Mode** | Device flagged as field-locked | Companion runs in “no storage” mode with soft-prompting only |

---

## 🔁 Offline Survival Mode Behaviors

| Feature | Adjusted Behavior |
| --- | --- |
| Companion Memory | Temporarily paused after 72h, resumed post-sync |
| Reflective Journals | Stored locally in protected vault |
| Safeguarding Prompts | Require local caregiver review and QR-flag |
| Language Settings | Fallback to default local language (preconfigured) |
| Consent Expiry | Auto-extended grace period + renewal nudge post-sync |
| Companion Tone | Switches to neutral and short format if memory is paused |
| Logging | Audit data appended locally in secure enclave |

---

## 📦 Offline Deployment Readiness Checklist

| Required | Description |
| --- | --- |
| ✅ Preloaded Prompt Library | Localized, full library on-device |
| ✅ Print Consent Packets | Paper consents + QR forms ready |
| ✅ Pre-synced Rotation Logs | Current state of device prior to dispatch |
| ✅ Backup Battery Kit | For areas without consistent electricity |
| ✅ Companion Self-Test Mode | Local debug diagnostics via QR |
| ✅ “Safe Mode” UX Card | Laminated script for caregivers if offline escalation needed |

---

## 🗂️ Local Log Retention Windows

| Data Type | Retention Limit |
| --- | --- |
| Memory & Reflection Metadata | 14–30 days depending on region |
| Consent Logs | Until manually deleted or rotation |
| Safeguarding Events | Held until manual sync or QR review |
| Device Health Logs | 30 days |

> ⛔ No user speech, sensitive entries, or real names are stored unless configured by NGO and caregiver consent.

---

## 🔧 Recovery & Sync Protocols

| Event | System Action |
| --- | --- |
| Internet Restored | Auto-sync begins with log priority |
| Flagged Safeguarding Logs | Uploaded first, alert generated |
| Rotation Completed Offline | Trigger manual sync script |
| Extended Offline Use (>30 days) | Notify admin on next signal, Companion enters “pause mode” |
| Device Compromised Offline | Lock and wipe locally via override PIN or QR tool |

---

## 🧰 Partner Tools & Templates

- 🧾 Offline Consent Booklet (multilingual printable)
- 📋 Survival Mode Companion UX Script
- 🧠 Mood & Reflection Tracking Sheet (paper-based)
- 📦 Rotation + Wipe QR Tags (batch printable)
- 🔐 Offline Memory Viewer (secure local access)
- 🛰 Sync Failure Incident Log
- 🧭 Regional Offline Deployment Checklist

---

## 🔒 Ethical Guardrails

| Rule | Status |
| --- | --- |
| No coercive use of Companion when offline | ✅ |
| Offline memory auto-locks beyond 30 days without sync | ✅ |
| Field kits clearly signal if Companion is in Survival Mode | ✅ |
| No user-identifying data exported from offline logs | ✅ |
| Consent always required before first sync | ✅ |

---

## 🔁 Cross-linked Governance Modules

- 🧰 Self-Maintenance Guide
- 🧾 Consent Expiry & Renewal
- 📦 Post-Rotation Data Handling SOP
- 🔧 Device Retirement SOP
- 🧠 Memory Layer & Personalization Governance
- 🧱 Regional Language QA System
