# 🖥️ Clinic & Caregiver Dashboard UI Specifications

**Owner:** Aubert

### **1. Purpose**

These specifications define the design, behavior, and constraints of the **Clinic Admin** and **Caregiver** dashboards. These views are:
- **Summary-only**, never showing raw session content
- Structured to promote **empathy and insight**, not control
- Fully aligned with **Law 25**, **PIPEDA**, and **Memora’s privacy ethos**
- Designed with aging users and healthcare workflows in mind
- Optimized for **tablet and web**, responsive for caregivers on mobile

---

### **2. Dashboard Types & Roles**

| Dashboard | Target Role | Access |
| --- | --- | --- |
| **Clinic Dashboard** | Authorized pilot site staff | Anonymized, read-only summaries |
| **Caregiver Dashboard** | Linked caregivers (via consent) | Shared visibility on routine effort |

---

### **3. Shared UI Design Standards**

| Feature | Rule |
| --- | --- |
| Touch targets | Minimum 44x44px |
| Contrast | Minimum 4.5:1 for all text/data |
| Language support | Bilingual (EN/FR toggle or browser-locale based) |
| Data freshness | Updates every 24 hours |
| Alert style | No red/yellow; use blue, purple, green for soft flags |
| Consent indicators | Must be visible at row-level if revoked/paused |
| Data summaries | Display streaks, session counts — not game types, mistakes, or content |

---

### **4. Clinic Dashboard UI Specifications**

### A. **Structure**

| Area | Contents |
| --- | --- |
| **Header** | Clinic name, patient count, last sync, language switch |
| **Tile Summary Row** |  |
| • Patients active this week |  |
| • 3+ day streaks |  |
| • Consent revoked |  |
| • Caregiver-linked |  |
| • Companion muted |  |
| **Main Table** | Per-patient row (anonymized): |
| • Status dot |  |
| • Sessions this week |  |
| • Last active date |  |
| • Companion state |  |
| • Consent flags |  |
| • “Export summary” (PDF) |  |
| **Filters** | By status, activity range, Companion state |

### B. **Permissions & Visual Cues**

| Field | Condition | UI Behavior |
| --- | --- | --- |
| Consent revoked | `status: revoked` | Red outline + lock icon + hover tooltip |
| Companion muted | `muted: true` | Grey icon with alt text: “Companion inactive” |
| Clinic access toggled off by user | `clinic_linked: false` | Row grayed with status: “Access disabled” |
| No caregiver linked | `caregiver_linked: false` | Icon: outline heart with slash |
| Export allowed | `export_permission: true` | Button: “Download summary” (PDF only, no raw data) |

---

### **5. Caregiver Dashboard UI Specifications**

### A. **Structure**

| Area | Contents |
| --- | --- |
| **Header** | Patient name (if consented), language toggle, Companion status |
| **Streak Tracker** | Days active this week, soft celebration icons (leaf, sparkle) |
| **Session Summary Tile** |  |
| • Last played: date + Companion encouragement |  |
| • Weekly recap: “5 sessions completed — great effort!” |  |
| • Encouragement prompt: template picker |  |
| **Encouragement History** | “Last message sent: July 4” + log of past 3 interactions |

### B. **Interaction Rules**

| Item | Behavior |
| --- | --- |
| Encouragement prompt | Opens modal with prewritten message templates |
| Encouragement limit | 1 per 7 days; Companion suppresses if rejected/muted |
| Consent revoked | Dashboard greets with: “Access to this view has ended.” |
| Language toggle | Changes all content (labels, messages, template previews) |
| Companion tone match | Message box color adjusts with Companion mood (`gentle`, `warm`, etc.) |

---

### **6. Accessibility Requirements**

| Requirement | Dashboard View |
| --- | --- |
| Focus states for all tiles/buttons | ✅ Both roles |
| Screen reader labels for all data rows | ✅ Both roles |
| Icons always accompanied by text or tooltips | ✅ Both roles |
| Large text toggle support (OS-level dynamic scaling) | ✅ Caregiver dashboard |
| WCAG 2.1 AA compliance (all views) | ✅ All dashboards |

---

### **7. Localization-Specific Behavior**

| Field | Rule |
| --- | --- |
| Date formats | EN: July 1, 2025 / FR: 1 juillet 2025 |
| Line wrapping | Labels must wrap gracefully on French views |
| CTA buttons | Always expand to fit text (min width = 80px mobile, 120px tablet) |
| Tooltip copy | Translated natively, never auto-translated |

---

### **8. Consent & Data Boundaries Enforcement**

| Scenario | UI Enforcement |
| --- | --- |
| Caregiver unlinked | View becomes inaccessible immediately; Companion log also gated |
| Clinic revoked | Row hidden or grayed with reason: “Consent withdrawn” |
| Silent mode | Encouragements suppressed, Companion visual removed |
| Session data export | Only PDF, only for authorized clinic roles, no row-level logs |

---

### **9. Linked Documents**

- 🧠 [Companion Behavioral System]
- 📋 [Consent & Privacy Flow]
- 📘 [Language & Tone Guidelines]
- 🧱 [Component Library Reference]
- 🧪 [UI/UX QA Checklist Template]
- 🖼 [Badge UX Reference]
- 🧯 [Edge Cases & Fail-Safes]
