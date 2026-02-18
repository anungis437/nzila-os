# 🎮 Gamified Experiences

**Owner:** Aubert

### **. Purpose**

This document defines Memora’s approach to **non-coercive, cognition-friendly gamification**. Games and mechanics are designed to:
- Encourage **gentle routine-building**, not performance pressure
- Support **adaptive pacing** and rest
- Respect cognitive load, age, and accessibility
- Remain fully **explainable**, **consent-gated**, and **tone-moderated**

Gamification in Memora is **fatigue-aware** and governed by our AI & Ethics Charter, Accessibility Implementation Guide, and Prompt Library.

---

### **2. Gamification Philosophy**

| Principle | Practice |
| --- | --- |
| **Non-punitive** | No failure states, no streak loss notification |
| **Cognitively supportive** | Exercises focus, memory, and pattern skills in short sessions |
| **Voluntary** | Games are never forced; suggested softly |
| **Inclusive** | Designed with aging adults, accessibility users, and caregivers in mind |
| **Tone-calibrated** | Companion uses affirming tone only; no pressure-based triggers |

---

### **3. Game Library (MVP)**

| Game | Cognitive Focus | Description |
| --- | --- | --- |
| **Memory Match** | Recall | Match paired icons in a grid with limited turns |
| **Sequence Builder** | Pattern recognition | Tap icons in a shown order after a short display |
| **Category Sorter** | Semantic association | Drag and drop words/images into logical groups |

Each game is localized, accessible (44px+ targets), and <5 minutes to complete.

---

### **4. Companion Integration**

| Moment | Behavior |
| --- | --- |
| Pre-game | Suggestion: “Let’s sharpen our memory — want to try Sequence Builder today?” [`neutral`] |
| In-game | Companion remains silent; no interruption |
| Post-game | “That was focused time well spent!” [`warm`] if engagement was ≥60 seconds |

Companion tone adapts to streaks, fatigue, and prior dismissals.

---

### **5. Motivation Systems (Phase 1)**

| Feature | Description |
| --- | --- |
| **Daily streaks** | Track of consecutive days with any game activity (max 7) |
| **Progress bar** | Visual indicator of completion per game |
| **Badges (non-public)** | Local-only icons shown for 3-, 5-, 7-day milestones |
| **Session recap** | Light summary of games played and minutes engaged |

No rewards are ever shared or compared between users. All gamification is private and purpose-driven.

---

### **6. Fatigue Safeguards**

| Trigger | Response |
| --- | --- |
| 3+ sessions in <6 hours | “You’ve been very active — feel like taking a break?” [`gentle`] |
| High dismissals of Companion prompts | Pause gamified nudges for 48h |
| Rapid reset of Companion or config | All badge systems suspended |

Rest is always encouraged after streaks. No messages imply failure.

---

### **7. Consent & Memory Governance**

| Area | Rule |
| --- | --- |
| Streaks | Only shown if `memory_enabled = true` |
| Companion suggestions | Require `companion_active = true` |
| Badge display | Suppressed if Companion is muted, reset, or fatigue detected |
| Caregiver visibility | Never includes streaks, scores, or badge data |

---

### **8. Accessibility & Bilingual Implementation**

| Element | Safeguard |
| --- | --- |
| Screen reader support | ARIA labels and narration-ready UI |
| Contrast & sizing | Meets WCAG 2.1 AA, tested in light/dark themes |
| Language parity | French game instructions match tone, brevity, and clarity |
| Timer elements | Optional or disabled by default |

Game mechanics are tested with screen reader and keyboard-only sessions (pilot clinics).

---

### **9. Future Expansion (Phase 2+)**

| Feature | Notes |
| --- | --- |
| **Challenge Sets** | Weekly goal: “Try all 3 games this week” |
| **Story Mode** | Guided sequences based on narrative arcs (with fatigue safeguards) |
| **Game Progress Memory** | Consent-based reference: “You last enjoyed Sequence Builder” |
| **Game Tone Adaptation** | Prompt tone matched to session energy level (if consented) |

All new features will be behind **feature flags** and reviewed by QA, Bilingual, and Compliance.

---

### **10. Governance Links**

- 🧠 [Companion Behavioral System]
- 🧬 [Memory Graph Reference]
- 🗣️ [Prompt Library]
- 🔐 [Consent & Privacy Flow]
- 🎯 [Scenario Playbooks]
- 🧯 [Edge Cases & Fail-Safes]
- 📋 [Accessibility Implementation Guide]
- 📊 [Data Schema Overview]
