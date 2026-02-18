# 🧱 Game Design Framework

**Owner:** Aubert

> “Engagement through clarity, not compulsion.”

---

### 🎯 Purpose

This framework defines the foundational mechanics CareAI uses to design gamified experiences that are:
- Cognitively engaging
- Emotionally safe
- Ethically grounded
- Modular, reusable, and clinically tolerable

It applies to all CareAI-powered interfaces that support:
- Habit formation (Smart Habits Assistant)
- Cognitive development (Puzzle Loop, MyLearning Companion)
- Wellness journaling and recovery (Memora)
- Reflection and mood tracking (Team Coach, Parent Companion)

This framework adheres to enterprise-grade standards for **consent**, **fatigue prevention**, and **regulated population readiness** (e.g., youth, neurodiverse, long-term care).

---

### 🧠 Design Pillars

The gamified logic in CareAI is built on evidence-based frameworks:

| Pillar | Description | Source |
| --- | --- | --- |
| **Autonomy** | Players choose participation, pacing, and reflection scope | Self-Determination Theory |
| **Competence** | Gradual challenge scaling with optional repetition | Growth Mindset, Flow Theory |
| **Relatedness** | Includes communal reflection mechanics, gratitude logs, and shared values | Humanistic Psychology |
| **Purpose & Identity** | Encourages user-authored arcs over externally set goals | Narrative Game Design |
| **Predictability & Safety** | All mechanics are opt-in, bounded, and never emotionally pressuring | Trauma-Informed Design |

> All gamified personas must pass through an Ethics + UX review cycle before release.

---

### 🧩 Core Mechanics Library (Persona-Specific Activation)

| Mechanic | Description | Active Personas |
| --- | --- | --- |
| **Streak Tracker** | Visual indicator of daily consistency (non-punitive) | Memora, Smart Habits |
| **Reflection XP** | Journal entries produce symbolic “growth progress” | Reflection Coach, Companion |
| **Mood Garden** | Emotions visually grow a garden (private and non-quantified) | Sleep Assistant, Memora |
| **Unlockable Prompts** | New affirmations unlocked via check-in streaks or milestones | Puzzle Loop, MyLearning |
| **Narrative Arcs** | Progress framed as a journey with branching emotional paths | Memora, Learning Companion |
| **Growth Rings** | Circular visual showing theme mastery (e.g., Calm, Confidence) | Puzzle Loop, Smart Habits |
| **Soft Badges** | Milestone symbols stored privately; never shown to others | Most non-clinical personas |
| **Progress Reflection Cards** | Milestone recaps with companion prompts (“Look how far you've come”) | Memora, MyLearning |

---

### ⚙️ Adaptive Mechanics (Built-in Restraints)

- Challenge pacing respects fatigue and silent disengagement
- Adaptive logic draws only from **opted-in** ambient patterns or user memory
- All game logic must degrade gracefully when gamification is disabled (Minimal Mode)
- Users may disable any individual mechanic at any time in settings

**Companions must never say:**
- "You're falling behind."
- "Try harder."
- "Others are doing better."

---

### 🚫 Non-Permissible Mechanics

- Competitive leaderboards
- FOMO-based countdowns (e.g., 24hr limits)
- Push-to-upgrade or unlock (monetization gamification)
- Reward interruptions in grief, trauma, or emergency states
- AI performance scoring (e.g., "you got 80% right")

---

### ✅ Design Safeguards

| Area | Enforcement |
| --- | --- |
| **Emotional State** | No gamified prompt shown during grief support, fatigue, or emergency |
| **Fatigue Guardrail** | All mechanic streaks include minimum reset thresholds and soft recovery |
| **Tone Integrity** | Companion tone never shifts to encourage mechanic participation |
| **Auditability** | All progression data logged and anonymized per product use |
| **User Control** | All game modules include disable/opt-out controls |
| **Neurodiversity Support** | Minimal Mode disables gamification by default |

---

### 📦 Implementation Ready

- All mechanics are tagged per persona + UX module
- Core loop schema is exportable to frontend/UX teams
- WCAG-compatible and tested for reading level appropriateness
- All mechanics pass Canadian youth platform regulatory review
