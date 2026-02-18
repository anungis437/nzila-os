# 🔁 Consent Expiry and Renewal Protocol

**Owner:** Aubert

Memora’s Companion only remembers **what it is allowed to remember** — and only for as long as consent remains valid. This protocol defines how **consent is tracked, expired, renewed, and reconfirmed** across both connected and offline deployments, reinforcing **privacy, autonomy, and data dignity**.

---

## 🎯 Core Objectives

- Establish **expiration timelines** for memory-related consent
- Provide **non-disruptive renewal prompts** to caregivers or users
- Ensure Companion memory shuts off automatically when consent lapses
- Maintain **legally sound audit trails** of all consent changes
- Support **offline-first deployments** with QR- or paper-based workflows

---

## 🗓️ Default Consent Duration

| Consent Type | Validity Period | Notes |
| --- | --- | --- |
| 🧠 **Memory Retention** | 90 days (default) | Configurable per deployment |
| 🗂️ **Caregiver Data Access** | 180 days | Includes co-pilot and export rights |
| 🧾 **Reflection Archiving** | 30 days | If archived and not exported |
| 🛡️ **Safeguarding Consent** | 365 days | Critical if tied to NGO care program |

> ⚠️ Expiration timers begin from the last consent interaction, not Companion use.

---

## 🔄 Renewal Flow (Standard)

1. **Expiry Window Approaching**

↳ System detects consent will expire in 7 days
1. **Prompt Delivery**

↳ Companion shows: “Would you like me to keep remembering this?”
1. **Caregiver Confirmation**

↳ Tap, PIN, paper form, or QR code triggers renewal
1. **Audit Log Updated**

↳ New timestamp and method of renewal recorded
1. **Continuation or Memory Off Toggle**

↳ If no response by expiry, memory auto-disables (not wiped)

---

## 📱 In-App UX (Caregiver & User)

### For Caregiver:

> “You’re in control of what’s remembered. Would you like to renew memory-sharing for the next 90 days?”

[✅ Yes – Continue Remembering]

[🛑 No – Turn Off Memory]

### For User (Age-Appropriate):

> “Do you want me to keep remembering what we talked about?”

[👍 Yes]

[🤫 No – Forget]

---

## 📋 Offline & Field Mode

| Method | Tool |
| --- | --- |
| 📄 Paper Renewal Card | Fillable date + checkbox + caregiver signature |
| 🧾 Sticker Tag | Attached to device indicating new consent status |
| 📦 QR Consent Renewal Packet | Printable for each field program (rotated quarterly) |
| 🧠 Companion Tone Prompt | Voice-based renewal (“Should I still keep this safe?”) |

---

## 🔐 Auto-Disable Memory Layer

If consent is **not renewed**, the Companion will:
- Softly shut off memory and reflection tracking
- Display “Memory is now off — I won’t remember until you say so”
- Keep previous memory in a **locked** state for 7 days (then wiped or exported if re-enabled)

---

## 📁 Audit & Compliance Logging

| Field | Tracked Value |
| --- | --- |
| Consent Type | Memory, CoPilot, Archive, Safeguarding |
| Consent Status | Active / Expired / Revoked |
| Last Update Timestamp | UTC + local time |
| Renewal Method | Tap / Form / QR / PIN |
| Associated Device ID | For traceability |
| Consent Owner | User (if of age) or caregiver ID hash |
| Memory State Change | ON → OFF or OFF → ON |

---

## 🧰 Toolkit & Templates

- Consent Renewal Prompt Library (UX strings)
- Offline Paper Renewal Form (multilingual)
- Memory Auto-Disable UX Script
- Caregiver Alert Email Template (for NGO-coordinated programs)
- Consent Ledger Sheet (for NGO program managers)
- Rotation Integration (auto-renewal optional toggle at reassign)

---

## 📊 Linked Compliance Modules

- 🧾 Memory Erasure Tracker
- ⚖️ Safeguarding Escalation Playbook
- 📦 Post-Rotation Handling SOP
- 🧠 Memory Layer Governance Overview
- 🧭 Companion Ethics & QA Guide

---

## ✅ Best Practice Summary

| Practice | Status |
| --- | --- |
| Default expiration timers applied per consent type | ✅ |
| Companion can gracefully auto-disable memory | ✅ |
| All renewals are auditable and locally logged | ✅ |
| Paper + digital paths are available for all renewals | ✅ |
| No feature loss outside memory if consent expires | ✅ |
| Expired memories are locked, not lost (for 7 days) | ✅ |
