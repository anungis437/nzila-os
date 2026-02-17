# 📊 SLA Tracker (Live Ledger)

Owner: Aubert

### **1. Purpose**

This document governs how Nzila’s Shared Services team tracks **actual usage vs. allocated service hours** across ventures. It enables:

- Real-time **burn tracking** for internal deployment
- Capital alignment with venture progress
- Visibility into **underused or overdrawn services**
- Auditability for spinout transitions and IP cost attribution

---

### **2. Tracker Format**

Each month, a new row is logged per venture per service.

| Field | Description |
| --- | --- |
| `Date` | YYYY-MM-DD (auto timestamped or manual entry) |
| `Venture` | e.g., Memora, Optiva |
| `Service Type` | Engineering, Design, Legal, Product Ops, Finance, etc. |
| `Hours Used` | Actual time tracked |
| `Internal Rate` | From Shared Services Valuation Table |
| `Total Value` | Calculated as `Hours Used x Rate` |
| `Logged By` | Team member name or initials |
| `Linked Ticket/Request` | Optional – link to intake form or project task |
| `Billing Status` | One of: `Allocated`, `Overage`, `Credit Remaining` |
| `Notes` | Optional – brief context, blockers, upcoming needs |

---

### **3. Billing Status Definitions**

| Status | Meaning |
| --- | --- |
| `Allocated` | Within pre-approved monthly threshold |
| `Overage` | Exceeds agreed budget – requires strategy team sign-off |
| `Credit Remaining` | Unused hours still available this month |

---

### **4. Review Cadence**

| Interval | Task |
| --- | --- |
| **Weekly** | Ops lead checks submissions for completeness |
| **Monthly** | Snapshot report pulled and sent to Finance & Strategy |
| **Quarterly** | Included in Strategic Review deck and Cap Planning session |

---

### **5. Exceptions & Overrides**

| Scenario | Rule |
| --- | --- |
| Emergent venture request | Must be approved by Strategy Office or Designate |
| Unused credits | Do not roll over unless approved in advance |
| Internal dev sprints | Must be tagged as `Core Build`, not venture-specific |
| Cross-venture request | Logged to requesting venture unless redirected by Ops |

---

### **6. Tracker Implementation**

Recommended tools:

- **Google Sheets (Short-Term):** Linked to shared drive; version-controlled monthly
- **Airtable or Notion DB (Mid-Term):** Tag-based filtering, chart exports
- **HaloPSA/Jira Integration (Long-Term):** Automated logging and billing tagging via ticket closures

---

### **7. Linked Docs**

- [Shared Services Directory]
- [Shared Services Valuation Table]
- [Capital Deployment Plan]
- [Strategic Review Template]
- [Access & Roles Matrix]
- [Spinout Criteria & Checklist]