# 📦 Post-Rotation Data Handling SOP

**Owner:** Aubert

This SOP ensures that when a Companion device is rotated to a new user or program, **no unintended data exposure or memory residue** remains — while enabling consented, meaningful export or archival for caregivers, researchers, or future re-engagement.

---

## 🎯 Objectives

- Prevent unconsented memory retention between users
- Ensure consistent offboarding of sensitive data
- Enable optional archival, impact analysis, or re-entry continuity
- Support both offline and online environments
- Comply with Memora’s privacy, ethics, and sovereignty principles

---

## 🧭 Rotation Triggers

| Scenario | Trigger |
| --- | --- |
| 🔁 **Device Reassignment** | Same program, new user (e.g. new youth at clinic) |
| 🎓 **User Graduation or Opt-Out** | User completed program or chose to leave |
| 📦 **Field Kit Return** | Device returned to NGO or Memora HQ for reuse |
| ⚠️ **Emotional Mismatch or Reset** | Companion no longer suitable for user tone context |
| 🧯 **Device Lost/Recovered** | Rotation triggered by recovery flow |

---

## 📋 Required Pre-Rotation Steps

| Step | Action |
| --- | --- |
| ✅ **User Consent Confirmation** | Confirm whether memory should be exported, wiped, or archived |
| 🧾 **Graduation Flow Completed** | Ensure companion exit script and memory options are finished |
| 🔒 **Memory Offload or Wipe** | Local memory layer purged or securely exported |
| 🗃️ **Metadata Archived (Optional)** | Session rhythms, tone shifts, prompt flags saved for NGO dashboard |
| 📄 **Rotation Log Initiated** | Unique Rotation ID assigned to device instance |

---

## 🔐 Memory Handling Options

| Option | Description | Used When |
| --- | --- | --- |
| 🧼 **Full Wipe** | Erase all memory, reflection history, tone data | Default for all unconsented or anonymous users |
| 📥 **Caregiver Export** | Printed or digital copy given to caregiver (or user) | When exit option selected at graduation |
| 🔒 **Secure Archive** | Memory sealed and stored with re-entry token | When re-use is planned or user may return |
| 📜 **Narrative Export** | Companion generates printable “story” of journey | Used in trauma-informed or youth deployments |

---

## 📊 Metadata Preservation (Non-identifiable)

| Type | Format | Use |
| --- | --- | --- |
| Session Count | Numeric | Usage pattern analysis |
| Prompt Use | Prompt ID only | Prompt effectiveness |
| Tone Adjustments | Tag logs | Companion QA |
| Memory Toggle Frequency | Count only | Consent awareness analysis |
| Exit Reason (coded) | Code only (e.g., opt-out, graduated) | Deployment metrics |

> ⚠️ No full content is stored unless specifically consented.

---

## 🧾 Rotation Log Format

| Field | Notes |
| --- | --- |
| Device ID | Auto-generated or QR-linked |
| Program ID | Where device was last used |
| User Memory Status | [Wiped / Archived / Exported / Unknown] |
| Rotation Timestamp | UTC + local time format |
| Rotation Reason Code | Coded field (graduation, mismatch, error recovery, etc.) |
| Rotation Technician / Staff | Initials or user ID |
| NGO/Clinic Notes | Optional free-text (no PII) |

---

## 📄 Offline-First Protocols

| Step | Tool |
| --- | --- |
| 🖨️ Memory Export | Printable PDF + Consent Summary |
| 📋 Rotation Checklist | Paper form with QR for re-digitization |
| 🧾 Device Tag | Sticker or tag indicating wipe/export status |
| 🧠 Recovery Card | Paper re-entry code (if memory archived offline) |
| 🔌 Local Logs | Exported via USB or SD card (encrypted format) |

---

## 🔁 Re-entry Compatibility

If user returns:
- Archived memory matched to Re-entry ID
- Consent re-confirmed before reactivation
- Companion resumes with "Reintroduction Script"
- All prior session trends remain audit-traceable

---

## 📂 Linked Assets & Templates

- Rotation Checklist (offline + app-based)
- Graduation Flow Summary Generator
- Memory Offload Tool (encrypted archive + PDF export)
- Secure Archive Consent Tracker
- Rotation Logbook Template
- Field Device Tag Sheet (wipe/export/archive indicators)
- NGO Rotation Dashboard Module

---

## ✅ Compliance Checklist

| Task | Required? | Notes |
| --- | --- | --- |
| Memory wiped or exported | ✅ Always |  |
| Graduation flow triggered | ✅ Always |  |
| Consent captured | ✅ If memory is archived or exported |  |
| Metadata anonymized | ✅ No raw content stored |  |
| Rotation log updated | ✅ Must link to device serial / QR |  |
| NGO notification | ⬜ Optional unless custom agreement |  |
