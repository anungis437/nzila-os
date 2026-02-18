# 🎮 Gamified Experiences Specification

**Owner:** Aubert

### **1. Purpose**

This document defines how Memora applies **gamified mechanics** to:
- Reinforce **routine use** without coercion
- Celebrate effort, **not achievement**
- Deliver **emotionally safe micro-rewards** (e.g., praise, streaks, badges)
- Support **Companion personalization**, clinic reporting, and caregiver encouragement

All experiences are non-competitive, non-addictive, and designed for users who may face **cognitive fatigue**, **attention limits**, or **age-related accessibility needs**.

---

### **2. Design Principles**

| Principle | Application |
| --- | --- |
| **Low-Stakes, High-Safety** | No punishments, no negative reinforcement |
| **Effort Over Outcome** | Praise for participation, not performance |
| **Predictable Rewards** | No random drops, surprise mechanisms, or variable schedules |
| **Fatigue-Aware** | Companion modulates intensity during recovery or low-energy states |
| **Caregiver-Aware** | Caregiver suggestions tied to engagement, not comparison |
| **Explainable Mechanics** | All gamification must be understandable in one sentence |

---

### **3. Core Gamification Elements (MVP)**

| Feature | Description | Trigger |
| --- | --- | --- |
| **Streak Tracking (1–7 days)** | Tracks consecutive daily session completion | Session completion within 24h window |
| **Daily Companion Affirmations** | “You’re keeping the habit — well done!” | Triggered on days 2+ |
| **Badge System (Pilot-Only)** | Visual recognition for effort, e.g., “3 Days Strong” | Day 3, Day 5, Day 7 |
| **Caregiver Ping Suggestions** | “Send a quick congrats?” prompt to linked caregivers | Day 3+ if enabled |
| **End-of-Session Companion Feedback** | “You focused for 6 minutes — great job!” | Session completion |
| **Prompt Nudges (“Want to keep the streak?”)** | Companion gently encourages continuity | If streak ≥ 2 |

> All praise is effort-based, not accuracy- or score-based.

---

### **4. Optional Rewards (Phase 2+)**

| Type | Description | Governance |
| --- | --- | --- |
| **Visual Companion Tokens** | Icons that appear briefly (e.g., a sparkle, flower) when streak is hit | Must be toggleable |
| **Custom Streak Goal Selector** | “Would you like to aim for 2 or 5 days?” | Requires opt-in |
| **Non-intrusive Challenge Mode** | Light weekly goals (“3 games this week”) | Opt-in only, Companion-rendered |
| **Rest Recognition** | “You took a break — we’re glad to see you back.” | Based on reactivation event |

All rewards must follow **AI Governance and UX Explainability** protocols.

---

### **5. Companion Gamification Behavior**

| Context | Example |
| --- | --- |
| Streak Day 3 | “That’s 3 in a row — awesome work staying consistent.” |
| Break Return | “Welcome back! Want to pick up where we left off?” |
| Long Streak Pause | “Let’s reset gently — ready for a fresh start?” |
| Badge Award | “You’ve earned your ‘3 Days Strong’ badge!” |
| Repeat Effort | “You’ve been showing up — that matters most.” |

Tone tags used: `warm`, `gentle`, `silent` (when streak ends or fatigue detected)

---

### **6. Visual Guidelines (Figma Alignment)**

| Element | Design Constraint |
| --- | --- |
| **Badges** | Minimalist, rounded, soothing colors (no reds, no medals/trophies) |
| **Progress Icons** | Optional, calm visuals (e.g., small path, sun, leaf) |
| **No Leaderboards** | Gamification is private and self-paced |
| **Caregiver-Visible Tags** | Displayed as “Engaged This Week” not numeric score |

---

### **7. Data Logging & Privacy Constraints**

| Metric | Retention | Privacy Rule |
| --- | --- | --- |
| `streak_count` | 30 days | Not shared with caregiver unless consented |
| `badge_award` | 30 days | Only displayed in-app, never exported |
| `caregiver_nudge_triggered` | 30 days | Tracked as an event, not tied to identity |
| `restored_after_break` | 90 days | For internal analytics only (opt-in) |

No gamification data is used for clinical evaluation or research exports without additional consent.

---

### **8. Fatigue & Overload Protection**

| Safeguard | Mechanism |
| --- | --- |
| **Streak Pause Reset** | After 3 missed days, streak resets silently |
| **Effort > Score Enforcement** | Companion always affirms time, not correctness |
| **Prompt Cooldown** | Streak nudges only occur once every 24h |
| **Rest Nudges Introduced** | Companion switches tone if too many sessions too close together |
| **Badge Suppression During Silent Mode** | Companion never awards badges when muted or memory reset |

---

### **9. Caregiver Integration**

| Feature | Rule |
| --- | --- |
| Encouragement suggestions | Only available after user completes 2+ sessions in a week |
| Badge visibility | Badge name only, no streak or duration shared |
| Consent required | Caregiver support tools hidden unless patient opt-in is active |
| Frequency limits | 1 suggestion per week max unless user increases streak |

---

### **10. Linked Documents**

- 🧠 [Companion Behavioral System]
- 🗣️ [Prompt Library]
- 🧬 [Memory Graph Reference]
- 📘 [Language & Tone Guidelines]
- 🔐 [Consent & Privacy Flow]
- 🎯 [Explainability & Control UX Plan]
- 📋 [AI Governance & Ethics Charter]
