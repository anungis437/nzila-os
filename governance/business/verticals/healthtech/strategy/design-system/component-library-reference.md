# 🧱 Component Library Reference

**Owner:** Aubert

### **1. Purpose**

This reference defines Memora’s **core UI components** and their required design, behavioral, and accessibility attributes. These components:
- Maintain **visual consistency across user roles** (patient, caregiver, clinic)
- Support **Companion-driven states and gamified feedback**
- Are designed for **WCAG 2.1 AA accessibility**, **bilingual parity**, and **low cognitive friction**
- Form the atomic foundation for layouts, dashboards, and Companion flows

---

### **2. Core Component Categories**

| Category | Description |
| --- | --- |
| **Inputs** | Text fields, toggles, dropdowns, date pickers |
| **Buttons** | Primary, secondary, link, icon-only |
| **Cards** | Used for game entry, reminders, session summaries |
| **Modals & Overlays** | For onboarding, consent, Companion resets |
| **Badges & Visual Tokens** | Soft gamification (e.g., “3 Days Strong”) |
| **Notifications & Toasts** | Light system messages |
| **Navigation** | Tab bars, drawers, breadcrumb flows |
| **Companion Containers** | Specialized visual framing for Companion prompts |
| **Accessibility Helpers** | Skip links, screen reader labels, live regions |

---

### **3. Sample Component Spec: Primary Button**

| Attribute | Value |
| --- | --- |
| **Name** | `button.primary` |
| **Usage** | Main call-to-action in modals, forms, onboarding |
| **States** | `default`, `hover`, `pressed`, `disabled` |
| **Padding** | `spacing.4` vertical × `spacing.6` horizontal |
| **Font** | `typography.size.md` + `weight.semibold` |
| **Corner Radius** | `radius.md` |
| **Colors** | `color.primary` background, `color.surface` text |
| **Accessibility** | 4.5:1 contrast, focus ring with `shadow.focus`, `aria-label` required for icon variants |
| **Multilingual UX** | Auto-expands up to 200% for long French text |
| **Voice & Narration** | Focusable, screen-reader friendly, no duplicate narration with Companion |
| **Disabled State Rule** | Greyed background + tooltip: “Action available after consent” (if gated) |

---

### **4. Companion-Sensitive Components**

| Component | Companion Awareness |
| --- | --- |
| **Companion Container** | Renders tone badge (`gentle`, `warm`, `neutral`), adjusts background subtly per state |
| **Badge Card** | Only appears when Companion triggers achievement event; hides during `silent_mode` |
| **Encouragement Prompt Box** | Used only for caregiver-ping interactions; suppressed if consent unlinked |
| **Companion Reset Modal** | Confirms full memory wipe and shows mute option with accessibility fallback |

---

### **5. Specialized Views**

### A. **Caregiver Message Selection**

- Prewritten template list, card-selectable with tone icon (e.g., 🌱 gentle, 🌞 warm)
- Button: `Send encouragement`
- Tooltip: “You’ll see a preview before sending.”
- WCAG: Keyboard navigable + aria-describedby for each card tone

### B. **Clinic Dashboard Summary Tile**

- Visuals: Greyscale + soft blue overlays
- States: `engaged`, `inactive > 3 days`, `consent revoked`
- No clickable links; view-only visual hierarchy
- Tooltip: “Based on anonymized session counts only”

---

### **6. Accessibility Enforcement by Component Type**

| Component | Must Include |
| --- | --- |
| **Text Input** | Visible label + screen reader label + error region |
| **Card** | Keyboard focusable wrapper + alt text on icons |
| **Toggle** | Visual + text state (“On”/“Off”) + aria-pressed |
| **Toast/Alert** | `role="alert"` + screen-reader live region |
| **Modal** | Focus trap + ESC dismiss + aria-labelledby |
| **Navigation Items** | 44px minimum touch targets + screen reader announcement |

---

### **7. Localization-Ready Patterns**

| Pattern | Application |
| --- | --- |
| **Expandable buttons** | Layout must support longer FR text (1.3x baseline) |
| **No embedded idioms** | All microcopy authored in EN/FR natively |
| **Tooltip support** | Must be available for both languages, dismissable |
| **Date formats** | Locale-aware (`DD/MM/YYYY` for Canada FR) |
| **Label alignment** | Left-aligned in EN, can support right-aligned layout FR if needed (Phase 2) |

---

### **8. Design Governance & QA**

| Rule | Application |
| --- | --- |
| All components defined in Figma master file | ✅ |
| Paired with Storybook (or equivalent) components | ✅ |
| Accessibility QA checklist per component | ✅ Required before release |
| Companion-aware variants flagged | ✅ In design + dev |
| Component registry versioned | ✅ Logged with changelog for localization & compliance reviews |

---

### **9. Linked Documents**

- 🎨 [Design Tokens Specification]
- 📘 [Language & Tone Guidelines]
- 🧱 [Badge UX Reference]
- 🧠 [Companion Behavioral System]
- 📋 [Accessibility Implementation Guide]
- 🧪 [UI/UX QA Checklist Template]
- 📎 [Consent & Privacy Flow]
