# 🧱 UI Component Framework

**Owner:** Aubert

### 1. 🎯 Purpose

The UI Component Framework defines the reusable, accessible, and emotionally calibrated interface elements used across Memora’s game suite and Companion interaction surfaces. It enables consistent visual language, low cognitive load, and bilingual accessibility across mobile and tablet deployments.

---

### 2. 📦 Core Categories

| Category | Description |
| --- | --- |
| **Input Controls** | Tap, drag, trace, and selection elements optimized for motor accessibility |
| **Feedback Animations** | Soft glow, progress visuals, celebration icons, and rest-day indicators |
| **Layout Blocks** | Card templates, prompt containers, dialog surfaces, rest break overlays |
| **Localization Tokens** | Contextual translation hooks for tone-sensitive phrasing |
| **Theme & Contrast Modes** | Light/dark modes, high contrast toggle, low-stim visual sets |

---

### 3. 🧩 Component Design Standards

| Principle | Implementation |
| --- | --- |
| **Modularity** | Each component is abstracted and parameterized for reuse across games |
| **Accessibility** | Compliant with WCAG 2.2 AA; includes aria-labels, screen reader tags |
| **Cognitive Simplicity** | Limits visual options to 2–3 actionable choices per screen |
| **Visual Tone Matching** | Components adapt to Companion tone state (e.g., soft vs. celebratory) |
| **Localization-Ready** | All text/content passed through `t()` function with fallbacks |

---

### 4. ⚙️ Development Stack

| Tooling | Role |
| --- | --- |
| **React Native + TypeScript** | Base framework with type-safe components |
| **Tailwind (React Native Variant)** | Themed utility classes for spacing, color, animation |
| **Figma Tokens** | Shared design tokens used in dev and design environments |
| **i18next** | Multi-language support with tone-scoped namespaces |
| **Storybook** | Visual component explorer with light/dark mode variants |

---

### 5. 🖼️ Visual States & Emotion Cues

| State | Example Elements |
| --- | --- |
| **Success** | Soft pulse, checkmark animation, gradient affirmations |
| **Pause** | Dim overlay, Companion avatar retreat, light day icon |
| **Reflection** | Text input card with glow, Companion thought bubble |
| **Error** | Avoids red; uses yellow-orange low-stress flags with retry CTA |

---

### 6. 📋 Accessibility Templates

| Mode | Features |
| --- | --- |
| **High Contrast Mode** | 7:1 ratio minimum, thick outlines, solid icons |
| **Low-Stim Mode** | Muted color palette, no animation, simplified UI cards |
| **Screen Reader Mode** | All components contain alt-labels and heading hierarchy |
| **Motor Accessibility** | Tap areas ≥ 48dp, drag zones with fallback buttons |

---

### 7. 🔐 Privacy by Design

- UI never displays raw Companion memory or behavioral data
- Journaling and prompt cards always include opt-in mechanism
- No component conditionally reveals emotional state without explicit user interaction

---

### 8. 📌 Linked Subcomponents (Next Pages)

- Input Controls & Interaction Modes
- Feedback Animations & States
- Localization & Copy Handling
- Accessibility Templates & Layout Rules
- 👆 Input Controls & Interaction Modes
- ✨ Feedback Animations & States
- ♿ Accessibility Templates & Layout Rules
- 🌍 Localization & Copy Handling
