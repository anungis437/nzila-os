# 🖼️ Clinic Pilot Dashboard Wireframes (UX Spec)

**Owner:** Aubert

### **1. Purpose**

This specification defines the **layout and interaction structure** of Memora’s Clinic Dashboard for pilot participants. It is focused on:
- Giving **clinics visibility into patient adherence and engagement**
- Maintaining **data minimization** and **non-clinical framing**
- Enabling **role-appropriate summaries only**, per Law 25 and pilot agreements
- Optimizing for **tablet-first UI**, with scalable behavior on desktop

---

### **2. Platform & Access Context**

| Access Mode | Notes |
| --- | --- |
| Tablet (iPad) | Primary use case in clinics |
| Web/Desktop | Supported (Chromium-based browsers preferred) |
| Authentication | Restricted to pilot clinic admins only |
| Language Toggle | Persistent top-right toggle: EN / FR |

---

### **3. Wireframe Overview – Layout Zones**
`plaintext
CopyEdit
+----------------------------------------------------------+
| Top Nav Bar: Logo | Dashboard | Language | Logout        |
+----------------------------------------------------------+
| Left Filter Panel              | Main Dashboard Content |
| - Date Range Selector          |                        |
| - Engagement Flag Toggle       | - Summary Tiles        |
| - Companion Muted Filter       | - Patient Table        |
+-------------------------------+------------------------+

`

---

### **4. Zone A – Top Navigation**

| Element | Function |
| --- | --- |
| Logo + Dashboard Label | Home breadcrumb + title |
| Language Toggle | EN/FR switch (updates in real-time) |
| Logout Button | Ends session, returns to login screen |

---

### **5. Zone B – Filter Panel (Left)**

| Filter | Description |
| --- | --- |
| Date Range Picker | Defaults to current week, expandable to 30 days |
| Flags Only Toggle | “Show only patients needing encouragement” |
| Companion Muted Filter | “Show only those who muted Companion” |
| Consent Status Filter | Hide/show patients with revoked access (greyed out rows) |

---

### **6. Zone C – Summary Tiles (Top Right Panel)**

| Tile | Value Displayed |
| --- | --- |
| **Patients Active This Week** | Count (e.g., 9) |
| **3+ Day Streaks** | Count with % (e.g., “4 of 12”) |
| **Patients Needing Encouragement** | Count flagged as inactive for 3+ days |
| **Companion Muted Rate** | % of linked patients who’ve muted prompts |
| **Consent Revoked** | Total (e.g., “2 revoked this week”) |

✅ *Tiles use soft color fills — green for positive, neutral greys for others.*

---

### **7. Zone D – Patient Engagement Table**

| Column | Description |
| --- | --- |
| **Patient Alias** | First name only, or clinic-assigned nickname |
| **Sessions (7d)** | Count, e.g., “3” |
| **Streak** | Icon + text, e.g., 🌱 “3 days” |
| **Last Active** | Date, e.g., “July 5” |
| **Companion** | Status: “Active” or “Muted” |
| **Caregiver Linked** | Icon indicator or “None” |
| **Consent Status** | “Granted” / “Revoked” (revoked = row greyed out) |
| **Export PDF** | Button: “Generate Summary” (pilot-only, not raw data) |

> Rows are non-clickable in MVP to avoid impersonation risk.

Exported PDF includes only **session count, streaks, and Companion state**.

---

### **8. Mobile/Tablet Responsiveness**

| Device Behavior | UX Pattern |
| --- | --- |
| Tablet Portrait | Collapsible filter drawer |
| Tablet Landscape | Full 2-column layout (filters + table) |
| Mobile (read-only, Phase 3) | Stack tiles vertically + simplified patient list (first name, session count) |

---

### **9. Accessibility & Compliance Features**

| Feature | Implementation |
| --- | --- |
| All buttons ≥44px | ✅ |
| Full screen reader support (labels, ARIA roles) | ✅ |
| Colorblind-safe flags and icons | ✅ Text + icon combos |
| All patient data is pseudonymized | ✅ No full PII shown |
| Audit logging tied to every row export or filter usage | ✅ Logged with user ID |

---

### **10. Linked Documents**

- 📊 [Clinic Dashboard Data Pipeline Spec]
- 📋 [Accessibility Implementation Guide]
- 🧪 [UI/UX QA Checklist Template]
- ✅ [Consent UI Flows]
- 🧩 [Component Version Control Registry]
- 📘 [Language & Tone Guidelines]
- 🗺️ [Screen Reader Path Maps]
