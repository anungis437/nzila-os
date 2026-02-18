# 🔌 Integration Layer & Data Portability

**Owner:** Aubert

*“If care systems can’t speak to each other, memory gets lost in the handoff.”*

This page outlines Memora’s approach to **secure integration**, **controlled data export**, and future-facing **interoperability** with healthcare, research, and family ecosystems. It ensures **memory-aware care** is portable, governed, and extendable — without violating Nzila’s foundational privacy principles.

---

## 🧱 **Design Philosophy**

| Pillar | Implementation |
| --- | --- |
| **Local First, Cloud Optional** | Companion data is always stored locally unless explicitly consented for sync |
| **User-Centered Export** | All data portability flows are built around caregiver and patient control, not system defaults |
| **Minimal Necessary Exposure** | Integration outputs are scoped to insights, not full interaction logs or raw voice data |
| **Standards-Aligned Architecture** | Readiness for FHIR, HL7, and WHO Digital Health Interoperability principles |

---

## 🧠 **Supported Data Types**

| Data Type | Description | Portability Level |
| --- | --- | --- |
| **Memory Summary** | Timeline of interactions, mood shifts, companion adjustments | 📤 Exportable (PDF, JSON) |
| **Companion Preferences** | Avatar choice, tone level, reading level, reflection timing | 🔄 Syncable across devices |
| **Emotional Resilience Trends** | Tracked fatigue/stress patterns over time | 📈 Reportable (opt-in only) |
| **Caregiver Feedback Logs** | Structured nudge responses, co-pilot annotations | 📄 Exportable (family or clinician share) |
| **Prompt Audit Trail** | What was said, and when | 🔒 View-only archive (not downloadable) |

---

## 🔐 **Consent-Governed Sync**

| Mode | Description | Use Case |
| --- | --- | --- |
| **Offline Mode** | All data stays local; no sync unless reconnected to app hub | NGO deployment kits, clinics |
| **Device-to-App Sync** | Encrypted local sync from tablet → caregiver app | Home use, family review |
| **Cloud Sync (Opt-in)** | Secure, encrypted cloud copy for backup or research | Research pilots, backup recovery |
| **Shared Profile Export** | Manually triggered summary export (PDF, JSON, Print) | Clinic intake, transition of care |

> 🔎 All sync actions are logged in an Audit Ledger, viewable by the caregiver and accessible only through passcode-authenticated portals.

---

## ⚙️ **Integration Targets (2025–2026)**

| System | Type | Notes |
| --- | --- | --- |
| **Clinic EMR/EHR** | HL7 / FHIR export-ready (non-diagnostic modules only) | Long-term goal for interoperability |
| **Nzila Product Stack** | Shared memory nodes with SentinelCare, Cognition Passport | Companion behavior alignment |
| **Government Wellness Platforms** | Read-only summary links | For public health dashboards |
| **Academic Research Portals** | CSV export of de-identified mood/resilience data | Ethics-board governed, anonymized |
| **NGO Dashboards** | Bulk insights (with caregiver approval) | Regional trends and outcomes |

---

## 📂 **Future-Ready Enhancements**

- 🔧 **Open API Sandbox** — for authorized researchers or integrated care platforms
- 🧬 **Memory Interchange Format (MIF)** — Nzila-native standard for memory-driven product sync
- 🔁 **End-of-Life Companion Transfer Protocol** — guided export for use across care transitions
- 🧾 **Portable Care Report Generator** — one-click summary of Companion insights for intake/funding forms
- 🔗 **FHIR Mapper Library** — mapping Nzila Companion fields to international medical vocabularies (LOINC, SNOMED CT)
