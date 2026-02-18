# 🌐 Data Jurisdiction Map

**Owner:** Aubert

**Version:** 1.0

**Maintained by:** Legal & Corporate Affairs + Security Office

**Last Updated:** [Insert Date]

This document provides an authoritative, auditable view of **data residency, access paths, regulatory alignment**, and **cross-border exposure** across Nzila Ventures’ systems and vendors. It enables legal defensibility, trust-by-design infrastructure, and proper mapping of global obligations under PIPEDA, Law 25 (QC), GDPR, and HIPAA (where applicable).

---

## 🔹 1. Purpose

Nzila Ventures operates in a global data environment. This map ensures:
- Clear understanding of where data *resides*, *transits*, and is *accessible*
- Regulatory obligations are fulfilled per jurisdiction
- Security teams can respond to sovereignty and breach questions rapidly

---

## 🗺️ 2. Jurisdiction Classification Framework

| Code | Type | Description |
| --- | --- | --- |
| **P** | Primary | Country where data is stored at rest |
| **A** | Accessible | Country from which data *may* be accessed (e.g. remote staff or vendors) |
| **X** | Transit | Country the data may pass through (e.g. CDNs, global routing) |
| **R** | Regulated | Jurisdictions with applicable laws requiring mapping (e.g., GDPR) |

---

## 🌍 3. Current Data Jurisdiction Map

| System / Vendor | Data Location(s) | Access From | Regulated Jurisdictions | Notes |
| --- | --- | --- | --- | --- |
| **Microsoft 365 (SharePoint, Outlook, OneDrive)** | 🇨🇦 Canada (Toronto) | 🇨🇦 🇫🇷 (Founder), 🇺🇸 (Emergency IT) | 🇨🇦 PIPEDA, QC Law 25 | Local storage via M365 Canada tenant. DSR-ready. |
| **Notion (Ops + Documentation)** | 🇺🇸 United States (AWS) | 🇨🇦 🇺🇸 🇫🇷 | 🇺🇸 CCPA, 🇪🇺 GDPR | Content not considered sensitive. Access logs maintained. |
| **QuickBooks (Finance)** | 🇺🇸 United States | 🇨🇦 🇺🇸 | 🇺🇸, 🇨🇦 | Subject to U.S. financial access logs. |
| **Brevo (Email / Support)** | 🇫🇷 France (OVH Cloud) | 🇨🇦 🇫🇷 | 🇪🇺 GDPR, 🇨🇦 | Consent flows mapped. Includes DSR export path. |
| **Slack (Vendor Comms)** | 🇺🇸 United States | Global | 🇺🇸, 🇨🇦 | Contains vendor/professional communications, not PII. |
| **Supabase (Product backend - Optiva)** | 🇪🇺 Frankfurt | 🇨🇦 🇪🇺 | 🇪🇺 GDPR | End-user data handled via European cloud instance. |
| **GitHub (DevOps)** | 🇺🇸 United States | 🇨🇦 🇺🇸 | 🇺🇸 | Private repos. Includes versioned code, not customer data. |

---

## 📋 4. Data Residency Policy Summary

- **Customer data** should remain in **Canada or EU** jurisdictions, unless explicitly exempted with consent.
- **Operational tooling** (docs, email) can operate from U.S.-based services if:
- No PII is stored
- Access logs and deletion paths are in place
- **Cross-border access** must be governed via NDAs and vendor compliance checks.

---

## 🛡️ 5. Regulatory Coverage Map

| Law | Applies To | Impacted Systems | Actions Taken |
| --- | --- | --- | --- |
| **Law 25 (Quebec)** | All Quebec users | M365, Notion, Supabase | Consent-first design, DSR pathways, privacy log |
| **PIPEDA (Canada)** | All Canadian users | All systems | Privacy notice, breach protocol, access audit |
| **GDPR (EU Users)** | 🇪🇺 data in Supabase, Brevo | Supabase, Brevo | DPO not required (non-EU controller); compliance documented |
| **HIPAA** *(future readiness)* | U.S. health partners | TBD | Product design excludes PHI. Will prepare BAA readiness when applicable. |

---

## 📌 6. Known Gaps / Watch Areas

| Issue | Status | Owner | Notes |
| --- | --- | --- | --- |
| Brevo DSR export validation | ⚠️ Pending | Legal | Confirm pipeline export path with timestamp |
| Slack data retention policy | ⚠️ Soft risk | Security | Review retention/deletion controls for workspace data |
| U.S. access from mobile work | ✅ Approved | Legal + IT | Bound by cross-border NDAs and endpoint security policy |

---

## 📁 Linked Legal + IT References

- **Security Policy Manual**
- **Vendor Security Review SOP**
- **Consent & Privacy Flow (Product)**
- **Incident Response Playbook**
- **M365 Data Residency Certificate (if available)**
