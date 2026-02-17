# 📂 SAFE Template (Nzila Version)

Owner: Aubert

### 🔹 1. Purpose

This document defines Nzila's standardized **Simple Agreement for Future Equity (SAFE)** structure, designed for:

- Ventures incubated or spun out of Nzila
- Governance and IP retention
- Low-overhead fundraising at early stages
- Clear equity conversion during priced rounds

---

### 🔹 2. Core Modifications from YC SAFE

| Clause | Nzila Adaptation | Purpose |
| --- | --- | --- |
| **IP License Disclosure** | Requires explicit reference to Nzila IP license in Section 1 | Prevents claims on core IP by investors |
| **Observer Rights** | Grants Nzila the right to observe all board/investor meetings | Maintains governance visibility |
| **Brand Use Clause** | Clarifies investor may not use or misrepresent Nzila branding | Avoids false affiliation |
| **Valuation Cap Floor** | Introduces optional **floor cap** to protect Nzila’s equity ceiling | Supports long-term IP ownership |
| **Spinout Trigger Conditions** | SAFE must convert *only* if the venture has met spinout criteria | Aligns with milestone-based fundraising |

---

### 🔹 3. SAFE Key Terms Table (Editable)

| Term | Field | Default |
| --- | --- | --- |
| Company Name | `text` | e.g., Memora Health Inc. |
| SAFE Amount | `currency` | e.g., $150,000 CAD |
| Discount | `%` | 15% |
| Valuation Cap | `currency` | $3,000,000 CAD |
| Valuation Floor (Optional) | `currency` | $1,500,000 CAD |
| SAFE Type | `dropdown` | Post-Money SAFE |
| Governing Law | `dropdown` | Ontario (Canada) |
| Investor Observer Rights | `checkbox` | ✅ |
| Nzila Observer Rights | `checkbox` | ✅ (required) |
| Nzila IP Reference | `checkbox` | ✅ (required) |

---

### 🔹 4. Required Attachments

| Document | Description |
| --- | --- |
| **IP License Summary Sheet** | Shows licensed components (Companion logic, prompt library, backend SDK) |
| **Nzila Cap Table Impact Sheet** | Shows how SAFE converts in current equity model |
| **Founders Agreement** | Confirms IP assignment and vesting |
| **Governance Memo** | Describes Nzila oversight rights |
| **Board Consent to SAFE** | Required board resolution for SAFE issuance |

---

### 🔹 5. Post-SAFE Requirements

After SAFE execution:

- Investor added to **Nzila Investor Tracker**
- Cap table updated and shared with CFO + Strategy Office
- **SAFE contract and all attachments** uploaded to `/Nzila Legal Vault/SAFE Agreements`
- Investor added to quarterly update distribution

---

### 🔹 6. Linked Governance Documents

- [Fundraising Gatekeeper Guide]
- [Nzila Cap Table Impact Sheet]
- [Royalty & Licensing Flow Model]
- [Memora Pitch Deck (Current)]
- [Spinout Criteria Checklist]
- [Nzila IP Licensing Agreement Template]