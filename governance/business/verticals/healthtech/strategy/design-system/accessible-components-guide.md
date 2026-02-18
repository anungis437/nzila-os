# ♿ Accessible Components Guide

**Owner:** Aubert

### **1. Purpose**

This guide defines how all reusable UI components in Memora are designed, built, and tested to meet:
- **WCAG 2.1 AA** accessibility standards
- Device-independent usability across **touch**, **keyboard**, and **screen reader** input
- Cognitive and physical **barrier reduction for aging users**
- Consistent **bilingual (EN/FR)** support, including longer label handling

---

### **2. Global Accessibility Principles**

| Principle | Application |
| --- | --- |
| **Perceivable** | Clear labels, color contrast ≥ 4.5:1, and visible focus states |
| **Operable** | Full keyboard/touch support, 44×44px min touch targets |
| **Understandable** | Predictable patterns, icon+label pairings, calm motion |
| **Robust** | Screen reader-friendly with appropriate ARIA attributes and role declarations |

---

### **3. Component Inventory (MVP Scope)**

| Component | Status | Notes |
| --- | --- | --- |
| Button (Primary/Secondary) | ✅ Accessible | Focus ring, full label, aria-pressed if toggle |
| Toggle Switch | ✅ Accessible | Labeled by visible text, `aria-checked` |
| Modal Dialog | ✅ Accessible | `role="dialog"`, focus trap, escape key to dismiss |
| Tooltip | ✅ Accessible | Keyboard-triggered with `aria-describedby` |
| Icon Button (e.g., close, back) | ✅ Accessible | Must include `aria-label` |
| Tabs | ✅ Accessible | Keyboard nav (`ArrowRight/Left`), `aria-selected` |
| Accordion | ✅ Accessible | Expand/collapse via keyboard, `aria-expanded` |
| Progress Indicator (Streak) | ✅ Accessible | Descriptive alt text: “3 days in a row” |
| Form Fields | ✅ Accessible | Labeled fields, error messages paired with `aria-describedby` |
| Companion Prompts | ✅ Screen reader opt-in | `aria-live` region only if prompt is non-passive |

---

### **4. Visual Design Standards for Accessibility**

| Element | Minimum Requirement |
| --- | --- |
| Text contrast | ≥ 4.5:1 foreground/background |
| Disabled UI | ≥ 2:1 contrast + tooltip or alt |
| Focus states | ≥ 2px outline with contrasting color |
| Font sizes | Base: 16px (`1rem`), scale-friendly via `em/rem` |
| Icon-only buttons | Never allowed without tooltips and labels |

---

### **5. Interaction & Navigation Patterns**

| Feature | Rule |
| --- | --- |
| Tab Order | Logical order by visual layout; use `tabindex` only when necessary |
| Escape-to-dismiss | Required on all modals, sheets, dialogs |
| Focus Trap | Must be enforced within modals and menus |
| Dynamic Content | Use `aria-live="polite"` for subtle in-app updates (e.g., Companion nudge) |
| Caregiver & Clinic dashboards | Table rows focusable; rows include `aria-label="Patient summary for..."` |

---

### **6. Component Variants for Fatigue & Aging Support**

| Component | Variant | Purpose |
| --- | --- | --- |
| Button | Large Tap Mode (Phase 2) | Increases padding, reduces spacing |
| Modal | Low-Stimulus Mode | Removes animation, increases font size |
| Game UI | High Contrast Mode | Optional toggle for custom themes |
| Streak Tracker | Icon-only replaced with labeled alt + tooltip | “Streak badge: 3 days active” |

---

### **7. Bilingual & Localization Safeguards**

| Rule | Implementation |
| --- | --- |
| All component labels authored in both EN/FR | ✅ |
| No truncation of long French labels | ✅ Text wrapping preferred |
| Tooltips & aria-describedby localized | ✅ Consistent language context |
| Date/time pickers | Locale-specific formatting (e.g., 1 juillet 2025) |

---

### **8. Testing Requirements**

| Method | Frequency | Tool |
| --- | --- | --- |
| Manual keyboard navigation | Weekly | Browser dev tools, VoiceOver / TalkBack |
| Contrast checks | Per release | Figma (Stark plugin), axe-core |
| Screen reader compatibility | Monthly | NVDA, VoiceOver |
| Dynamic font scaling | QA sessions | iOS/Android accessibility settings |
| Accessibility regression testing | CI pipeline step | Pa11y or axe-core CLI |

---

### **9. Linked Documents**

- 📋 [Accessibility Implementation Guide]
- 🧪 [UI/UX QA Checklist Template]
- 🧠 [Companion Behavioral System]
- 🧱 [Component Library Reference]
- 🎨 [Design Tokens Specification]
- 🖼 [Fatigue Mode UI Adjustments]
- 📘 [Language & Tone Guidelines]
- 🧯 [Edge Cases & Fail-Safes]
