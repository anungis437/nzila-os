# 🧬 Anonymized Research Cohort Structure

**Owner:** Aubert

### **1. Purpose**

This document defines how Memora groups, labels, and manages **anonymized research cohorts** for clinical and academic pilots, without storing or sharing any **personally identifiable information (PII)**. It ensures:
- Full separation of user identity from research datasets
- Traceable, export-ready cohort tagging for analysis
- Cohort mapping aligned to pilot design, location, and research scope
- Secure multi-site study support

---

### **2. Cohort Concept Overview**

| Concept | Description |
| --- | --- |
| **Cohort** | A group of users opted into the same research protocol, clinic pilot, or study window |
| **Cohort Tag** | A unique, versioned alphanumeric label assigned per group (e.g., `RNH-OTTAWA-2025Q1`) |
| **Cohort Map Table** | Secure internal table mapping cohort IDs to pilot info (never user names or emails) |
| **Anonymized User ID (AUID)** | A UUID used exclusively in research exports, with no linkage to platform credentials |

---

### **3. Cohort Assignment Logic**

| Method | Rule |
| --- | --- |
| **Clinic onboarding** | Users from a clinic-enabled pilot are auto-tagged with that cohort ID (e.g., RNH) |
| **Study-specific opt-in** | Upon research consent, users are tagged into a cohort defined by study metadata |
| **Cohort override** | A user may only belong to **one research cohort per study scope** |
| **Multi-phase pilots** | Versioned cohort IDs (e.g., `RNH-2025Q1`, `RNH-2025Q2`) used to isolate timelines |

---

### **4. AUID Generation & Rotation**

| Feature | Behavior |
| --- | --- |
| **UUIDv4 schema** | 100% non-reversible; no embedded timestamps |
| **One AUID per cohort** | If a user is in multiple cohort studies, they receive separate AUIDs |
| **Rotation upon opt-out** | AUID is invalidated if consent is revoked |
| **Stored in separate key store** | Access limited to Data Protection Officer and export script logic only |

---

### **5. Cohort Metadata Table (Internal Only)**

| Field | Description |
| --- | --- |
| `cohort_id` | e.g., `RNH-MTL-2025Q1` |
| `study_name` | “Pilot: Early MCI Routine Adherence” |
| `clinic_partner` | RNH |
| `geography` | Quebec (EN/FR) |
| `ethics_protocol_id` | Optional, if managed under IRB |
| `export_allowed` | True/False (flag from consent model) |
| `reporting_frequency` | Monthly / Quarterly |
| `language` | en / fr / mixed |

---

### **6. Example Export File Structure**
`/research_exports/
 └── cohort-RNH-MTL-2025Q1/
     ├── sessions.csv
     ├── caregivers.csv
     ├── prompts.csv
     ├── consent_log.csv
     └── README_metadata.txt

`

> Each file uses AUIDs only. No names, emails, IPs, device IDs, or inferred location data included.

---

### **7. Cohort ID Naming Convention**

| Segment | Rule |
| --- | --- |
| **Site code** | Clinic or pilot org (e.g., RNH) |
| **Location** | Optional: region or city (e.g., OTTAWA) |
| **Date Window** | Study start quarter or month (e.g., 2025Q1 or 2025M03) |

**Example**: `RNH-OTTAWA-2025Q1`

---

### **8. Revocation Handling**

| Case | Result |
| --- | --- |
| User revokes research consent | AUID retired; export exclusion flag activated |
| User unlinks caregiver | Caregiver-specific entries removed if part of caregiver cohort |
| Clinic contract ends | Cohort marked “inactive”; no further exports allowed |

---

### **9. Linked Documents**

- 📤 [Pilot Data Export Specification]
- ✅ [Consent for Research Extension]
- 📘 [Consent & Privacy Flow]
- 🧪 [Anonymization & Data Lifecycle Policy]
- 🧱 [Audit Logging Strategy]
- 📐 [Impact Measurement Framework]
