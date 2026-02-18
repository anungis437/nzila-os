# 🧭 Caregiver Dashboard UX Spec

**Owner:** Aubert

### **1. Purpose**

The Caregiver Dashboard provides **lightweight, opt-in visibility** into a linked patient’s cognitive wellness routine. Designed for **non-clinical family members or trusted supporters**, it prioritizes:
- **Emotional reinforcement**, not medical judgment
- **Summarized engagement cues**, not raw performance data
- **Consent-bound access only**, with full revocation rights
- A UI built to support **aging users on both sides** of the interaction

---

### **2. Access Conditions**

| Requirement | UX Enforcement |
| --- | --- |
| Patient must explicitly link caregiver via in-app consent | No access until confirmed |
| One caregiver per patient (MVP) | Duplicate prevention built into flow |
| Caregiver account requires email + basic onboarding | No anonymous viewing |
| Patient may revoke access anytime | “Unlink” option clearly visible in patient profile |
| Dashboard becomes read-only after link removal | Caregiver sees: “Access ended by patient” |

---

### **3. Dashboard Entry Point**

| Platform | Path |
| --- | --- |
| Mobile | Home tab → “My Linked Patient” card |
| Web (Phase 2) | Navigation bar → “Care Dashboard” |
| Notification | Tapping a Companion-triggered encouragement opens summary |

---

### **4. UX Goals & Emotional Design Principles**

| Principle | Implementation |
| --- | --- |
| Calm, neutral tone | “Last played 2 days ago” instead of “Inactive” |
| No performance-based visuals | No scores, errors, or comparisons |
| Encouragement over tracking | Suggestion UI: “Send a note of support?” |
| Mutual dignity | No “report card” UI or judgmental badges |
| Role-aligned visibility | Caregiver sees only what the patient has agreed to share |

---

### **5. Dashboard Layout (Mobile View)**

### A. **Top Header**

- Patient avatar + first name only (no full PII)
- Status summary: “You’re linked to Alex — your support matters.”

### B. **Weekly Summary Tile**

| Element | Behavior |
| --- | --- |
| Sessions This Week | Number only, e.g., “3 sessions played” |
| Streak Label | “3-day consistency streak” (if applicable) |
| Last Activity | “Last session: 2 days ago” |
| Companion Status | “Companion: Active” or “Muted by user” |

### C. **Encouragement Module**

- Suggestion UI: “Send a boost?”
- Dropdown: choose from prewritten messages
- Optional toggle: “Let Companion mention you next time”

### D. **Caregiver Actions Panel**

| Option | Behavior |
| --- | --- |
| View Session Summary (Current Week) | Text-only recap: “Played Memory Match twice” |
| Notification Settings | Enable/disable weekly summaries |
| Unlink Patient | Opens confirm modal: “You’ll no longer see updates” |

---

### **6. Accessibility Features**

| Feature | Implementation |
| --- | --- |
| Text scaling support | All UI tested at 200% |
| All buttons ≥44px | Touch-friendly design |
| Aria-labels for screen reader navigation | “Button: Send encouragement to Alex” |
| Full bilingual EN/FR toggle support | All labels authored natively |
| No time-based charts or fine-grained graphs | Prevents cognitive overload |

---

### **7. Tone & Language Guidance**

| Context | Sample Copy |
| --- | --- |
| Streak highlight | “Alex is showing great consistency!” |
| Missed days | “You haven’t seen an update in 3 days — want to check in?” |
| Encouragement prompt | “Would you like to cheer them on today?” |
| Revoked access | “Access has been turned off by Alex. You can always reconnect later.” |

---

### **8. Limitations (MVP)**

| Feature | Status |
| --- | --- |
| Multiple patients per caregiver | ❌ Not supported in MVP |
| Custom encouragements | ❌ Prewritten message bank only |
| In-app chat | ❌ Excluded (Phase 3 feature consideration) |
| Performance metrics or analytics | ❌ Explicitly excluded |

---

### **9. Privacy & Consent UX Notes**

| Enforcement | Description |
| --- | --- |
| All access is timestamped and logged | Caregiver activity appears in audit log |
| Patient controls all linkage and revocation | Caregiver cannot relink independently |
| No Companion prompt logs shown | Only usage summaries |
| Data stored in Canada | Compliant with Law 25 and PIPEDA |

---

### **10. Linked Documents**

- ✅ [Consent UI Flows]
- 🧠 [Companion Behavioral System]
- 📋 [Accessibility Implementation Guide]
- 🧪 [UI/UX QA Checklist Template]
- 📘 [Language & Tone Guidelines]
- 🧱 [Component Library Reference]
- 🧩 [Component Version Control Registry]
- 🗺️ [Screen Reader Path Maps]
