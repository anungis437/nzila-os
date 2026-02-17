# 🧮 Nzila Cap Table Impact Sheet

Owner: Aubert

**Purpose:**

To provide a **standardized equity structure** across Nzila Ventures initiatives, showing ownership impact, IP retention, and dilution scenarios for all spinouts, SAFE rounds, and licensing models.

---

### 🔹 1. Base Structure

| Field | Type | Description |
| --- | --- | --- |
| **Entity** | `Dropdown` | Memora, Optiva, etc. |
| **Cap Table Version** | `Text` | e.g., v1.2 – July 2025 |
| **Date Updated** | `Date` | Timestamp of last modification |
| **Pre-Money Valuation** | `Currency` | Valuation used for SAFE or priced round |
| **Total Shares (Authorized)** | `Number` | Standardized (e.g., 10,000,000) |
| **Nzila Ownership (%)** | `Formula` | Based on IP contribution + governance equity |
| **Nzila IP License Status** | `Yes/No` | Indicates if formal IP agreement is in place |
| **Nzila Observer Rights** | `Yes/No` | Indicates board/investor meeting access |
| **SAFE Investors** | `Table` | Name, Amount, Discount, Cap |
| **Founders** | `Table` | Name, Role, Equity %, Vesting Schedule |
| **Equity Pool Reserved** | `%` | For employees or advisors (e.g., 10–15%) |

---

### 🔹 2. Equity Breakdown Table

| Shareholder | Role | Class | Shares | % Ownership | Notes |
| --- | --- | --- | --- | --- | --- |
| Nzila Ventures | IP Holder | Common A | 4,000,000 | 40% | Locked pre-spinout |
| Founder A | CEO | Common B | 2,500,000 | 25% | 4-year vesting |
| Founder B | CTO | Common B | 1,500,000 | 15% | 4-year vesting |
| Advisor Pool | — | Option | 1,000,000 | 10% | Board-approved grants |
| SAFE Investors | — | Convertible | — | — | To convert on priced round |
| Equity Reserve | — | Option | 1,000,000 | 10% | Hiring flexibility |

---

### 🔹 3. IP Impact Modelling (Scenarios)

| Scenario | Nzila Equity % | IP Royalty | Governance Retained | Notes |
| --- | --- | --- | --- | --- |
| **Standard Spinout** | 30–40% | 2–5% of revenue | Yes (observer + board seat) | Default model |
| **Licensing Only (No Spinout)** | 0% | 5–7% royalty | No | Clinical SDK or research deployment |
| **Equity-for-Use** | 10–15% | 0–2% | Yes (observer) | When IP fee converts to equity stake |
| **Venture Buyout** | Negotiated | 0–2% | No | Requires board vote & payout |

---

### 🔹 4. Key Policies Embedded

| Policy | Enforcement |
| --- | --- |
| **IP Must Be Licensed Before Fundraising** | ✅ Required |
| **All Founders Must Assign IP to Nzila First** | ✅ Assignment clause in Founders Agreement |
| **Nzila Retains Governance Seat Pre-Series A** | ✅ Documented in SAFE/Note |
| **Nzila Branding Use Must Be Approved** | ✅ Via Brand Licensing Agreement |

---

### 🔹 5. Linked Governance Docs

- [Fundraising Gatekeeper Guide]
- [IP Licensing Agreement Template]
- [Nzila Founders Agreement Template]
- [SAFE Term Sheet (Nzila Edition)]
- [Venture Operating Agreement Template]
- [Royalty & Licensing Flow Model]