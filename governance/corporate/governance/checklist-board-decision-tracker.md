# 📋 Board Decision Tracker

Owner: Aubert

**Purpose:**

To log, monitor, and reference all board-level decisions across Nzila HQ and its ventures, including capital approvals, IP licensing, venture spinouts, and governance shifts.

---

### 🔹 1. Tracker Fields (Database Structure)

| Field | Type | Description |
| --- | --- | --- |
| **Decision ID** | `Auto-ID` | Unique reference (e.g., BD-2025-04) |
| **Date** | `Date` | Date decision was finalized |
| **Venture** | `Dropdown` | Memora / Optiva / Nzila HQ / All |
| **Topic** | `Tag` | Capital, IP, Licensing, Spinout, Governance, HR, Legal |
| **Decision Summary** | `Long Text` | Short description of the motion and outcome |
| **Vote Outcome** | `Dropdown` | Unanimous / Majority / Deferred / Denied |
| **Capital Impact** | `Currency` | $ amount if applicable (capital unlock, investment approval) |
| **IP Impact** | `Yes/No` | Does it affect IP licensing, retention, or transfer? |
| **Linked Files** | `File` | PDF, deck, or legal doc associated |
| **Owner / Submitter** | `Person` | Nzila lead or venture rep who raised the motion |
| **Review Status** | `Dropdown` | Scheduled / Reviewed / Archived |
| **Comments / Follow-Up** | `Text` | Key follow-up tasks or obligations |

---

### 🔹 2. Example Entries

| Decision ID | Date | Venture | Topic | Summary | Outcome | Capital Impact |
| --- | --- | --- | --- | --- | --- | --- |
| BD-2025-04 | 2025-06-15 | Memora | Capital | Approved $75K for pilot launch phase | Unanimous | $75,000 |
| BD-2025-05 | 2025-06-30 | Nzila HQ | IP | Approved outbound licensing framework for Companion Engine | Majority | — |
| BD-2025-06 | 2025-07-12 | Optiva | Governance | Deferred spinout vote pending milestone report | Deferred | — |

---

### 🔹 3. Usage Notes

- All capital decisions **must be logged** before disbursement.
- **IP-affecting decisions** require linked legal approval.
- This tracker supports **audit readiness** and **quarterly board reporting**.
- Tag governance-sensitive decisions for later inclusion in the [Governance Archive].

---

### 🔹 4. Linked Documents

- [Governance Policy (Lightweight)]
- [Strategic Review Template]
- [IP Licensing Agreement Master]
- [Spinout Criteria & Checklist]
- [Board Pack Template]
- [Nzila Cap Table Impact Sheet]