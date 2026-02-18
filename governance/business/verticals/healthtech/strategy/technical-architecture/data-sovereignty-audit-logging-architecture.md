# 🔐 Data Sovereignty & Audit Logging Architecture

**Owner:** Aubert

This system ensures that every key interaction with Memora — from toggling memory to exporting data — is **audited transparently**, with **region-based controls**, **no surveillance**, and **caregiver-informed consent**. All logs are designed to support **regulatory compliance**, **ethical review**, and **deployment accountability**, without compromising user dignity or data minimalism.

---

## 🎯 Objectives

- Guarantee **user and caregiver control** over all stored data
- Ensure that **all system-level decisions are auditable** (e.g. memory turned on/off, reintroduction triggered)
- Maintain **data sovereignty** — logs stored **locally or within regional boundaries** only
- Enable partners and field teams to demonstrate compliance without storing sensitive reflections
- Provide **granular transparency** into Companion behavior and updates

---

## 🗂️ Core Logging Categories

| Log Type | Examples | Stored Data |
| --- | --- | --- |
| 🧠 **Memory Activity** | Toggle ON/OFF, export, wipe | Timestamp, type, user/caregiver ID hash |
| 🛡️ **Consent Events** | Signed, renewed, expired, revoked | Method, timestamp, scope |
| 🔁 **Companion Updates** | Prompt pack changes, tone evolution, model tuning | Version ID, deployment context |
| 🧾 **Session Metadata** | Mood check-in, prompt usage, skip behavior | Time, action type (no content) |
| ⚖️ **Safeguarding Flags** | Flag raised, resolved, paused | Incident type code (anonymized) |
| 📦 **Device Lifecycle** | Deployed, rotated, reassigned | Device ID, program ID, memory state |
| 📊 **Analytics Opt-in** | Learning loop participation, prompt feedback | Aggregated metrics only |

---

## 🧱 Technical Architecture

### 🔐 Local-First Logging (Default)

- Logs written to encrypted local storage (device-level)
- Each log entry has a **checksum**, **timestamp**, and **local jurisdiction tag**
- Companion behavior can be reviewed from logs **even when offline**
- Logs exported only with **caregiver-initiated sync or printout**

---

### 🌐 Optional Sync Model (Cloud-Linked Environments)

- Logs encrypted in transit via TLS 1.3
- Regional log storage (e.g. 🇨🇦 Canada for Canadian deployments)
- Accessible only to program partners (NGOs, clinics) via role-based access
- Retention limit: 90–180 days unless extended with explicit consent

---

## 📋 Audit Log Format (Core Fields)

| Field | Description |
| --- | --- |
| Log ID | Unique entry ID with hash |
| Device ID | Tied to physical hardware |
| Consent Scope | Memory / CoPilot / Export / Safeguarding |
| Action Type | Toggle / Export / Prompt Skipped / Tone Adjusted |
| Actor Type | User / Caregiver / Staff / Companion (auto) |
| Timestamp (UTC + Local) | Recorded on device |
| Region | Jurisdiction for compliance |
| Outcome Code | Success / Denied / Error / Expired |
| Notes (Optional) | Metadata only, no reflection content |

---

## 🧑‍⚖️ Privacy & Legal Compliance

| Principle | Status |
| --- | --- |
| No log stores full reflection content | ✅ |
| All actions tied to hashed user/device ID | ✅ |
| Logs are **non-volatile and append-only** | ✅ |
| Erasure logs retained (metadata only) after memory wipe | ✅ |
| GDPR / Law 25 / Nzila AI Charter compliant | ✅ |
| Caregiver visibility into audit logs (view-only mode) | ✅ |
| Printout version available for offline reviews | ✅ |

---

## 🔧 Admin & Field Tools

- **Audit Log Viewer (Offline + Online Modes)**
- **Region-Specific Export Tool**
- **Consent Ledger Generator** (with filters by child, caregiver, or program)
- **Companion Change Tracker** (tone + script version map)
- **Memory Layer Audit Sheet** (for partner reporting)
- **QR-linked Device Log Summary Printer** (for clinics or auditors)
- **Event Resolution Notepad** (offline tool to mark safeguarding actions taken)

---

## 🌐 Sovereignty Logic by Deployment Type

| Deployment Type | Data Residency | Log Sync Behavior |
| --- | --- | --- |
| 🇨🇦 Canadian Clinic | Canada-only (e.g. Azure Canada) | Optional sync every 30 days |
| 🌍 Global NGO | Country of operation (if infrastructure exists) | Manual sync only |
| 🛖 Offline Field | No external sync | Logs retained locally or exported via USB |
| 🏥 Hospital-Integrated | Local hospital server or locked SD storage | Logs shared via secure admin interface |

---

## 🧭 Ethical Oversight & Review

| Reviewer | Role |
| --- | --- |
| 🌐 **Partner NGO HQ** | Quarterly log reviews for anomalies |
| 🧠 **Memora Product Team** | Trend analysis on non-personal logs |
| ⚖️ **Nzila Ethics & Compliance Unit** | Random audit reviews across deployments |
| 🧑‍⚕️ **Caregivers (optional)** | Can view log summaries linked to their child/device |

---

## 📎 Linked Modules

- 🧾 Memory Erasure Tracker
- 🔁 Consent Renewal Protocol
- ⚖️ Safeguarding Escalation Playbook
- 📦 Device Rotation SOP
- 🧠 Companion Ethics & QA System
