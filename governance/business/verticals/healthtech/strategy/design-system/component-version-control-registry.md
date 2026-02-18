# 🧩 Component Version Control Registry

**Owner:** Aubert

### **1. Purpose**

This registry establishes a system of **version control for UI components**, allowing Memora teams to:
- Track **component revisions** across releases
- Ensure consistent **cross-platform behavior**
- Support smooth **handoffs between design and development**
- Enable **QA test planning**, **accessibility compliance logging**, and **rollback readiness**

---

### **2. Versioning Principles**

| Principle | Practice |
| --- | --- |
| **Semantic versioning (vMAJOR.MINOR.PATCH)** | Used for all tracked components (e.g., `Button v1.2.0`) |
| **Single source of truth** | All version updates reflect in the central Notion registry |
| **Design–Dev parity** | Figma + component library (React/Flutter) must match versions |
| **Accessibility reviews required for major versions** | Any redesign triggers a11y retesting |
| **Backward compatibility required unless deprecated** | Documented deprecation window = 1 release cycle |

---

### **3. Registry Table Format**

| Component Name | Version | Last Updated | Status | Notes |
| --- | --- | --- | --- | --- |
| Button (Primary/Secondary) | v1.3.0 | 2025-07-15 | ✅ Live | Refreshed spacing + contrast |
| Toggle Switch | v1.1.1 | 2025-06-10 | ✅ Live | Fixed tap target inconsistency |
| Modal Dialog | v1.2.0 | 2025-07-03 | ✅ Live | Focus trap improved |
| Companion Speech Bubble | v1.0.0 | 2025-07-02 | ⏳ Pilot | Initial implementation, FR tone testing |
| Badge Tile | v1.1.0 | 2025-06-20 | ✅ Live | Added ARIA label support |
| Session Summary Card | v1.0.0 | 2025-07-10 | 🧪 QA | Pending i18n string key audit |
| Navigation Tab Bar | v1.2.1 | 2025-06-30 | ✅ Live | Now scales up to 7 tabs |
| Game Grid (Memory Match) | v1.0.2 | 2025-07-08 | ✅ Live | High contrast mode support added |

---

### **4. Versioning Triggers**

| Trigger | Results In |
| --- | --- |
| Visual redesign | Minor or major version increment |
| Accessibility bug fix | Patch increment |
| Interaction behavior change (e.g., animation, delay) | Minor version |
| String key refactor | Patch if internal; Minor if affects localization |
| Platform-specific change (e.g., Android-only) | Suffix: `v1.2.1-android` |

---

### **5. Release Notes Format (Linked to Each Entry)**
`### Component: Toggle Switch
**Version:** v1.1.1
**Release Date:** 2025-06-10
**Changes:**
- Increased touch target to 48px
- Added `aria-checked` to improve screen reader compatibility
- French label wrapping issue resolved
**QA Passed:** ✅ iOS / ✅ Android / ✅ Web
**Linked Screens:** Settings, Notifications
**Figma File:** [Toggle Switch v1.1.1 Spec](https://figma.com/toggleswitch)

`

---

### **6. Review & Governance Workflow**

| Action | Role |
| --- | --- |
| Version proposal | UX Lead or Frontend Engineer |
| a11y review required for all `x.0.0` releases | A11y Reviewer |
| QA test plan updated | QA Lead |
| Approved by | Product Owner |
| Registry updated by | Design Ops or UI Systems Coordinator |

---

### **7. Tooling & Integration Notes**

| Tool | Use |
| --- | --- |
| Figma | Maintains design token linkage + version stamps |
| Git (Dev) | Component library tagged by version in repo |
| Notion | Canonical version registry + release notes |
| Storybook (Phase 2) | Central sandbox for previewing component states |
| Percy/Chromatic | Visual regression testing tied to each release |

---

### **8. Deprecation Protocol**

| Condition | Action |
| --- | --- |
| Component flagged for removal | Tagged `DEPRECATED` in registry |
| Deprecation window | Must remain backward compatible for 1 full release cycle |
| Migration note | Added to component documentation in Notion and Figma |
| Replaced by | Link to new component and changelog entry |

---

### **9. Linked Documents**

- 🧱 [Component Library Reference]
- 🧪 [UI/UX QA Checklist Template]
- 📋 [Accessibility Implementation Guide]
- 🎨 [Design Tokens Specification]
- 🗺️ [Screen Reader Path Maps]
- ✍️ [Design Sign-Off Protocol]
