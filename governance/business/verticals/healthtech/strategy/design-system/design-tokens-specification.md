# 🎨 Design Tokens Specification

**Owner:** Aubert

### **1. Purpose**

Design tokens define Memora’s **core visual building blocks** (color, spacing, typography, sizing, motion) as structured, code-ready variables. This enables:
- **Consistent styling across platforms** (React Native, web, dashboard)
- **Easier theming for silent mode, fatigue states, or clinical use cases**
- **WCAG-compliant accessibility at the foundational level**
- **Rapid localization support** (e.g., larger French strings, right-aligned caregiver views)

---

### **2. Token Categories**

| Category | Description |
| --- | --- |
| `color.*` | All UI and content color values |
| `spacing.*` | Padding, margins, layout rhythm |
| `typography.*` | Font families, sizes, weights, and line heights |
| `radius.*` | Corner rounding for buttons, cards, modals |
| `shadow.*` | Depth and elevation (low-cognitive-load shading) |
| `motion.*` | Animation speed and curve tokens |
| `layout.*` | Breakpoints and grid logic for mobile/web consistency |

---

### **3. Core Token Set (Sample)**

### 🎨 **color.**

> Emotionally calm, high-contrast for accessibility, with tone alignment for Companion.`json
CopyEdit
"color.primary" : "#3B82F6",        // Calm blue (Companion focus)
"color.secondary" : "#10B981",      // Teal green (growth, support)
"color.surface" : "#FFFFFF",        // Base UI
"color.background" : "#F9FAFB",     // Light neutral backdrop
"color.text.primary" : "#111827",   // High-contrast black
"color.text.secondary" : "#6B7280", // Muted grey
"color.alert.gentle" : "#E0F2F1",   // Used in fatigue mode / silent cues
"color.stroke.subtle" : "#E5E7EB",  // Dividers, inactive borders
"color.link" : "#2563EB"            // Actionable links

`

---

### 📐 **spacing.**

> 4pt spacing scale, optimized for touch UI and accessibility padding.`json
CopyEdit
"spacing.0": "0px",
"spacing.1": "4px",
"spacing.2": "8px",
"spacing.3": "12px",
"spacing.4": "16px",
"spacing.5": "20px",
"spacing.6": "24px",
"spacing.8": "32px",
"spacing.10": "40px",
"spacing.12": "48px"

`

---

### 🅰 **typography.**

> Friendly, legible font system — system fonts with fallback.`json
CopyEdit
"typography.family.base": "'Manrope', 'Helvetica Neue', sans-serif",
"typography.size.sm": "14px",
"typography.size.md": "16px",
"typography.size.lg": "18px",
"typography.size.xl": "20px",
"typography.weight.regular": "400",
"typography.weight.semibold": "600",
"typography.lineheight.tight": "1.25",
"typography.lineheight.base": "1.5"

`

---

### 🔲 **radius.**

> Soften edges to increase approachability and tap comfort.`json
CopyEdit
"radius.none": "0px",
"radius.sm": "4px",
"radius.md": "8px",
"radius.lg": "12px",
"radius.full": "9999px"

`

---

### 🌫 **shadow.**

> Minimal elevation — used sparingly to avoid visual noise.`json
CopyEdit
"shadow.card": "0 1px 4px rgba(0, 0, 0, 0.06)",
"shadow.focus": "0 0 0 3px rgba(59, 130, 246, 0.5)", // Focus ring
"shadow.dropdown": "0 4px 12px rgba(0, 0, 0, 0.08)"

`

---

### ⏱ **motion.**

> Slow, calming motion to reduce cognitive load.`json
CopyEdit
"motion.duration.short": "150ms",
"motion.duration.medium": "250ms",
"motion.duration.long": "400ms",
"motion.curve.standard": "cubic-bezier(0.4, 0, 0.2, 1)"

`

---

### 📱 **layout.**

> Breakpoints for responsive design, adapted to multilingual layouts.`json
CopyEdit
"layout.breakpoint.sm": "640px",
"layout.breakpoint.md": "768px",
"layout.breakpoint.lg": "1024px",
"layout.breakpoint.xl": "1280px",
"layout.container.max": "1440px"

`

---

### **4. Companion-Specific Tokens (State Aware)**

| State | Custom Token Behavior |
| --- | --- |
| `silent_mode` | Suppresses color.accent and badge icons |
| `fatigue_mode` | Substitutes surface backgrounds to soft greys/greens |
| `warm_state` | Increases text contrast for affirmations |
| `gentle_state` | Reduces motion to 0, increases button padding |

These tokens cascade into the Companion logic and are triggered by state machines (defined in the Companion Behavioral System).

---

### **5. Token Governance**

| Action | Owner |
| --- | --- |
| Token updates | Design Lead + Frontend Engineer |
| Accessibility reviews | UX QA Specialist |
| Localization visual tests | Bilingual UI Reviewer |
| Versioned token registry | Maintained in design system (Figma + code sync) |

---

### **6. Linked Documents**

- 🎨 [Component Library Reference]
- 📘 [Language & Tone Guidelines]
- 📋 [Accessibility Implementation Guide]
- 🧠 [Companion Behavioral System]
- 🧪 [UI/UX QA Checklist]
- 🖼 [Badge UX Reference]
- 🎭 [Scenario Playbooks]
