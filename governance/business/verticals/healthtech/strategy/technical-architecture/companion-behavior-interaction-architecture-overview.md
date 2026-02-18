# 🧠 Companion Behavior & Interaction Architecture Overview

**Owner:** Aubert

### **1. Purpose**

This document provides an integrated overview of Memora’s Companion system — a **scripted, consent-aware, multilingual interface** designed to offer **predictable, fatigue-sensitive support** during cognitive engagement. The architecture ensures all behaviors are:
- Emotionally safe and clinically non-diagnostic
- Governed by clear, auditable logic
- Adaptive to user consent, state, and preferences
- Fully explainable and compliant with WCAG 2.1 AA, Law 25, and internal AI ethics

---

### **2. Architecture Components**

| Document | Focus Area |
| --- | --- |
| ✅ **Prompt Library** | All Companion messages, tone tags, categories, and consent gating |
| ✅ **Memory Graph Reference** | Defines bounded, consent-based memory used to personalize prompts |
| ✅ **Scenario Playbooks** | Structured behavior sequences across common user journeys (onboarding, recovery, fatigue) |
| ✅ **Edge Cases & Fail-Safes** | Guardrails and suppression rules for non-linear or sensitive situations |
| ✅ **Consent & Privacy Flow** | How Companion behavior aligns with user control, consent revocation, and data handling |
| ✅ **Monitoring & Incident Response Plan** | Operational responses to anomalies, system errors, and clinical alert boundaries |
| ✅ **Language & Tone Guidelines** | Bilingual tone system, readability constraints, emotional safety rules |
| ✅ **Gamified Experiences** | Logic behind safe, optional gamification without coercion or over-stimulation |
| ✅ **Companion Accessibility Guide** | WCAG/AODA-compliant interaction patterns, screen reader support, and keyboard/touch design |

---

### **3. System Philosophy**

| Principle | Description |
| --- | --- |
| **Predictable** | Companion never surprises; all messages are explainable and non-generative |
| **Consent-First** | Behavior adapts instantly to consent toggles, muting, or reset |
| **Fatigue-Aware** | No streak pressure, prompt cooldowns, rest cues enforced |
| **Multilingual by Design** | All prompts are authored in EN/FR with tone parity, not translated post-facto |
| **Non-Interpretive** | No LLM-driven emotional detection, inference, or profiling |

---

### **4. Operational States**

| State | Behavior Summary |
| --- | --- |
| `Neutral` | Default mode; minimal personalization, soft tone |
| `Warm Momentum` | Activated by 2+ sessions/week; affirming tone, game nudges |
| `Gentle Recovery` | Triggered after 48h absence; encouraging tone, rest-first pacing |
| `Silent Mode` | No prompt output; Companion visible as a badge only |
| `Low-Frequency Mode` | Activated by fatigue or dismissal patterns |
| `Reinforcement Loop` | Streak reward tone, never escalatory or coercive |

---

### **5. Governance Alignment**

| Standard | Enforcement |
| --- | --- |
| WCAG 2.1 AA | Verified in Companion UI, dashboard, and games |
| Law 25 (Quebec) | Consent logging, localization, opt-in only personalization |
| Memora AI Charter | No profiling, black-box behavior, or clinical overreach |
| Explainability UX Plan | All Companion actions traceable in system logic |
| Audit Logging Strategy | Every key interaction, toggle, and fallback logged |

---

### **6. Linked Companion Stack (For Editors & Devs)**

- 🧠 [Prompt Library]
- 🧬 [Memory Graph Reference]
- 🎭 [Scenario Playbooks]
- 🧯 [Edge Cases & Fail-Safes]
- 🔐 [Consent & Privacy Flow]
- 🚨 [Monitoring & Incident Response Plan]
- 🗣️ [Language & Tone Guidelines]
- 🎮 [Gamified Experiences]
- ♿ [Companion Accessibility Guide]
- 
🧠 Companion Behavioral System
- 
🗣️ Prompt Library
- 
🧠 Memory Graph Reference
- 🎭 Scenario Playbooks
- 🧯 Edge Cases & Fail-Safes
- 🔐 Consent & Privacy Flow
- 🧠 Explainability & Control UX Plan
- 📊 Audit Logging Strategy
- 🧯 Monitoring & Incident Response Plan
- 🗣️ Language & Tone Guidelines
- 🎮 Gamified Experiences
- ♿ Companion Accessibility Guide
