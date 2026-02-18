# ⚙️ Settings Screen Architecture

**Owner:** Aubert

### **1. Purpose**

This document defines the structure, layout, and behavior of the **Settings screen** across Memora’s:
- **Patient mobile app**
- **Caregiver dashboard (limited subset)**
- **Tablet fallback view (clinic mode)**

Goals:
- Ensure all **consent, preference, and support actions** are easily discoverable
- Minimize **cognitive load** through clean categories
- Provide **accessible, bilingual, and touch-friendly UI**
- Enforce **reversibility, transparency, and consent control** in all sections

---

### **2. Navigation Path**

| Device | Location |
| --- | --- |
| Mobile (Patient) | Tab Bar → Profile → Settings |
| Caregiver | Avatar menu (top-right) → Settings |
| Tablet | Left-side menu item: “Settings” |

Accessible via keyboard, screen reader, and tap gesture.

---

### **3. Primary Sections**

| Section | Purpose |
| --- | --- |
| **Account** | Language, app version, caregiver link |
| **Companion** | Behavior, tone preferences, reset |
| **Notifications** | In-app reminders, encouragement triggers |
| **Privacy & Consent** | All user consents, caregiver/clinic linking, data export |
| **Support & Feedback** | Contact, bug report, terms, request deletion |

---

### **4. Detailed Section Structure**

---

### A. **Account Settings**

| Item | Behavior |
| --- | --- |
| Language Preference | Toggle EN/FR → updates full UI immediately |
| Linked Caregiver | Status card: “Linked to [Name]” → Unlink button |
| Clinic Access | Status: “Access Enabled” → Toggle off with confirm modal |
| App Version | Read-only text (e.g., v1.0.3) |
| Logout | CTA → Confirm → Returns to splash/login screen |

---

### B. **Companion Settings**

| Item | Behavior |
| --- | --- |
| Enable Companion Prompts | Toggle; if off = enters `silent_mode` |
| Companion Voice Tone (optional, Phase 2) | Selection: Gentle / Neutral / Uplifting |
| Reset Companion Memory | CTA opens [Memory Reset UX modal] |
| Daily Encouragements | Toggle for light nudge prompts (“Try again today?”) |
| Leaf Icon Color (aesthetic only, optional Phase 2) | Personalization for Companion bubble color |

---

### C. **Notifications**

| Item | Behavior |
| --- | --- |
| Routine Reminders | On/off toggle; morning/afternoon scheduling (Phase 2) |
| Caregiver Encouragements | Toggle “Allow encouragements” (requires caregiver link) |
| Badge Reveal Pings | “Show badges immediately” vs. “Show in Profile only” |
| Fatigue Mode Adjustments | Auto-activate if inactive → “Pause reminders for now” |

---

### D. **Privacy & Consent**

| Item | Behavior |
| --- | --- |
| View Consent Log | Opens modal with timestamped entries |
| Withdraw Research Consent | Toggle → Confirm modal |
| Unlink Caregiver | CTA → Confirm unlink prompt |
| Revoke Clinic Access | CTA → Greys out dashboard rows |
| Request Account Deletion | CTA → Opens [Deletion UX modal] → “This cannot be undone” |

---

### E. **Support & Feedback**

| Item | Behavior |
| --- | --- |
| Contact Support | Opens email client or in-app form |
| Report Bug | Opens short feedback modal with dropdown |
| Terms & Privacy Policy | Opens PDF or web page view (EN/FR) |
| Rate This App (optional Phase 2) | Redirect to App Store / Play Store |
| Legal Information | Footer link → opens compliance notice section (e.g., Law 25 summary) |

---

### **5. Layout Guidelines**

| Rule | Value |
| --- | --- |
| Font size | `typography.size.md` (16px) base; `lg` for headers |
| Icon size | 24px, paired with text on left |
| Section spacing | `spacing.6` (24px) between groups |
| Toggle alignment | Right side, 44px min touch area |
| Modal height | 60–80% of screen; full screen for mobile |
| Scroll behavior | Vertical scroll only; sticky headers optional |

---

### **6. Accessibility & Localization**

| Feature | Rule |
| --- | --- |
| All actions labeled in EN/FR | ✅ Native copy, no truncation |
| Icon + Label pairing | ✅ No icon-only buttons |
| Dynamic font scaling | ✅ (supports OS-level preferences) |
| Focus state for all inputs | ✅ Keyboard & touch navigable |
| Modal confirmation dialogs | `aria-describedby` with concise summaries (“This resets Companion memory only.”) |

---

### **7. Edge Case UX Handling**

| Scenario | UX Behavior |
| --- | --- |
| Caregiver link removed | Companion behavior adapts; encouragement toggle greyed |
| Consent revoked | Dashboard access removed; Companion prompt suppressed |
| Inactive account (7+ days) | Light banner shown: “Settings may have changed — review recommended” (Phase 2) |
| Legal framework changes | Soft banner: “New policy terms available” → opens in Settings |

---

### **8. Linked Documents**

- 🧠 [Companion Behavioral System]
- ✅ [Consent UI Flows]
- 📘 [Language & Tone Guidelines]
- 🧯 [Edge Cases & Fail-Safes]
- 📋 [Accessibility Implementation Guide]
- 🧼 [Memory Reset UX]
- 🧱 [Component Library Reference]
- 🧪 [UI/UX QA Checklist Template]
