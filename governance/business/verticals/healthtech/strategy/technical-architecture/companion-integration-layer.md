# 🤝 Companion Integration Layer

**Owner:** Aubert

### 1. 🎯 Purpose

This layer orchestrates real-time connections between the Companion and Memora’s game engine during cognitive wellness sessions. It maps gameplay signals to tone-calibrated prompts, rest suggestions, and emotional feedback moments, forming the core of Memora’s relational technology strategy.

---

### 2. 🧠 Integration Overview

| Component | Function |
| --- | --- |
| **Trigger Map Parser** | Interprets in-game events into context-specific Companion actions |
| **Tone Modulation Engine** | Adapts Companion tone mode based on user behavior, fatigue score, and emotional input |
| **Prompt Scheduler** | Manages delivery timing of Companion prompts to avoid overload or interruptions |
| **Fallback Engine** | Handles silent mode, caregiver-muted scenarios, and non-consent fallback states |

---

### 3. 🔄 Event Flow Logic
`sequenceDiagram
    participant Game as Game Engine
    participant Companion as Companion Core
    Game->>Companion: eventTrigger({ type: 'success', fatigue: 30 })
    Companion->>Companion: Parse triggerMap + toneMode
    Companion->>Game: prompt("Well done today. Want to pause?")`

---

### 4. 🎨 Tone Calibration Model

| Input | Companion Response |
| --- | --- |
| **Fatigue Index ≥ 70** | Quiet Support tone + rest invitation |
| **Recent Completion** | Encouraging tone + optional journal nudge |
| **Multiple retries** | Reassuring tone + affirming user agency |
| **High input delay** | Offer to pause or lighten load |
| **User quiet toggle** | Tone disabled, fallback system engaged |

---

### 5. 📋 Integration Requirements

| Requirement | Enforcement |
| --- | --- |
| **Tone Mode Handling** | Must respect Companion tone context (reassuring, quiet, etc.) per user profile |
| **Multilingual Support** | Prompts must support English and French, tone-adjusted for cultural fit |
| **Caregiver Scope Checks** | No prompt triggers based on caregiver input unless explicitly enabled |
| **Rest Flow Sync** | All rest suggestion triggers must map to SDK fatigue model thresholds |

---

### 6. 🧩 Companion Prompt Types

| Type | Example | Use Case |
| --- | --- | --- |
| **Affirmation** | "You showed up. That matters." | End of light session or early exit |
| **Rest Suggestion** | "Let’s pause here and check back later." | High fatigue or hesitations detected |
| **Reflective** | "How did that feel today? Want to note it?" | Game end, milestone met |
| **Silent Presence** | No output | Companion muted by user or caregiver |

---

### 7. 🔐 Privacy & Safety Protocols

| Control | Description |
| --- | --- |
| **Prompt Anonymity** | Logged only as type ID, never content, unless explicitly consented |
| **Silent Mode Compliance** | Companion must auto-disable if mute flag present in session context |
| **Caregiver Trigger Isolation** | Caregiver view summaries never influence live prompts unless linked via config flag |
| **Reflection Prompt Opt-In** | All journal-related prompts are optional, disabled by default |

---

### 8. 📌 Future Enhancements

- Dynamic tone personalization per user memory/behavior trends
- Companion voice mode for audio-capable deployments
- CMS-managed tone packs for clinical vs. personal environments
- Tone calibration testing tools for QA/dev teams
- 🧭 Trigger Map Parser
- 🎨 Tone Modulation Engine
- ⏱️ Prompt Scheduler
- 🚫 Fallback Engine
