# 🖥️ Studio Admin UX Wireframe & Permissions Model

**Owner:** Aubert

The Studio Admin Console is the **internal control layer** for Memora and other Nzila Ventures products. It offers role-based access to deployment metadata, memory governance, behavioral QA workflows, and prompt systems across all live, pilot, or archival deployments.

---

## 🎯 Purpose

- Provide **Nzila Ventures staff and studio leads** with unified visibility over Companion deployments
- Enforce ethical audit workflows across memory, tone, and consent layers
- Enable **multi-studio management** (e.g. Memora, MyLearning Companion, PuzzleLoop)
- Allow **role-based, bounded interaction** with sensitive product data
- Power **localization, prompt QA, deployment tagging**, and impact reviews — without interfering with live field use

---

## 🧱 Core Admin Modules

### 🗂️ Dashboard Overview

Unified summary of all products, deployments, and open governance items.

| Widget | Description |
| --- | --- |
| 🌍 Active Deployments Map | Geo-tagged status of kits/devices |
| 🔁 Consent & Memory Alerts | Flags for expired, unsynced, or opt-out toggles |
| 🧭 Prompt Drift Reports | UX-triggered QA signals for tone mismatch |
| 📦 Kit Rotation Logs | Upcoming or overdue resets |
| 🎓 Studio Activity Feed | Team assignments, audit completions, QA reviews |

---

### 🧾 Prompt & Tone QA Panel

Audit and manage the prompt libraries and Companion tone settings.

| Feature | Use |
| --- | --- |
| 📚 Library Audit Queue | View prompts flagged in field or marked “unclear” |
| 🧠 Tone Consistency Tracker | Maps tone across products + QA thresholds |
| 🧾 Prompt Versioning & Localization | Manage edits, translations, region variants |
| 🔄 Real-time Prompt Sync Monitor | Flagged if deployments have outdated prompt libraries |

---

### 🧬 Memory Governance Module

Manage memory lifecycle policies and event-level oversight.

| Feature | Use |
| --- | --- |
| 🔐 Memory Layer Log Viewer | View anonymized memory events by region/studio |
| 🔁 Memory Wipe Tracker | Confirmed vs. pending wipes (user or system-triggered) |
| 🧾 Consent Override Auditor | List of any manual or admin-consent updates |
| 🛡️ Shadow Memory Config Manager | Configure rulesets by demographic or deployment class |

---

### 📦 Deployment Lifecycle Console

View and control field kit metadata, health, and retention.

| Feature | Use |
| --- | --- |
| 📋 Device Status Table | Battery, storage, sync history, Companion version |
| 📦 Deployment Staging Flow | Set up kits for staging, QC, or transfer |
| 🔧 Maintenance Queue | Flag devices for rotation, sanitation, or decommission |
| 🗂 Kit History Viewer | Full audit of use history by hashed ID |

---

### 📊 Insight Feedback & Research Panel

Access real-world outcome data and research modules.

| Feature | Use |
| --- | --- |
| 🎯 Impact Indicator Feed | Weekly summary of resilience, memory use, reflection trends |
| 📘 Donor Report Exporter | Package opt-in data into redacted impact summaries |
| 🧪 Research Tracker | Track active IRB projects and consent scope |
| 📥 Partner Feedback Inbox | Uploads from NGO field staff or clinical leads |

---

### 🔐 Governance & Audit Layer

Permission-based access to sensitive flows and ethical flags.

| Feature | Use |
| --- | --- |
| 🧭 Escalation Log Viewer | View Companion misfire reports + actions taken |
| 🧾 Audit Trail Replayer | Browse time-stamped session logs (with redactions) |
| 🧯 Ethics Review Queue | View unresolved safeguarding triggers |
| 🛡️ Compliance Map | View system alignment by jurisdiction (PIPEDA, GDPR, etc.) |

---

## 🔐 Permissions Model (Role-Based Access Control)

| Role | Description | Modules |
| --- | --- | --- |
| 🧠 **Studio Lead** | Oversees studio ops, ethics, and QA | All modules |
| 🧰 **QA Reviewer** | Reviews tone, prompt, Companion behavior | Prompt & Tone QA, Memory Logs |
| 🛡 **Compliance Admin** | Monitors consent, misfires, data flows | Memory, Governance, Audit |
| 🧪 **Research Liaison** | Supports IRB coordination and research use | Insight Panel, Memory, Consent |
| 🧩 **Localization Manager** | Handles translations and regional tuning | Prompt QA, Deployment Console |
| 📦 **Field Logistics Coordinator** | Monitors device health, kit rotation | Deployment Console |
| 🔎 **Read-Only Auditor** | View-only mode for execs or partners | Dashboard + select panels |

> Each role includes 2FA + region-specific scoping and an audit trail of changes.

---

## 🔁 Crosslinked Systems

- 🔐 Data Sovereignty & Audit Logging Architecture
- 🧠 Companion Ethics & Behavioral QA
- 🧾 Consent Expiry & Renewal Protocol
- 📘 Prompt Library Governance Index
- 📦 Device Imaging & Configuration SOP
- 🔧 Deployment Console (Partner-Facing Layer)

---

## ✅ Integrity & Redundancy

| Area | Safeguard |
| --- | --- |
| Consent override? | Always dual-signed or QR-confirmed |
| Misfire not resolved? | Escalated automatically to Ethics Queue |
| Prompt drift flagged? | Locks auto-sync until reviewed |
| Role change made? | Full log with reviewer required |
| Data export? | Only with role + region tag + donor-ready scope |
