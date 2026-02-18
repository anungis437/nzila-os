# 🧠 Personality & Memory Frameworks

**Owner:** Aubert

> “Behavior is architecture. Memory is permission.”

This section defines how CareAI companions maintain identity, tone, and relationship continuity — safely, intentionally, and accountably.

---

### 🧩 What This Is

This framework governs how all CareAI personas:
- Express tone, pacing, and linguistic style
- Manage memory states (session, persistent, and ambient)
- Adapt to user mood, identity, and boundaries
- Maintain emotional consistency across days, devices, and touchpoints

It ensures:
- Persona integrity across platforms and time
- Explicit memory consent and erasure logic
- A safe, warm, non-performative experience
- Configurable defaults per product and per user type

---

### 🎭 **Personality Model**

Each **CareAI Persona** is composed of:

| Layer | Description |
| --- | --- |
| **Tone Signature** | Emotional setting: Calm, Friendly, Professional, etc. |
| **Behavioral Pacing** | Sentence rhythm, response length, question frequency |
| **Empathy Profile** | How the persona reflects, validates, and offers support |
| **Authority Level** | Ranges from companion (0) to procedural helper (3) |
| **Stylistic Features** | Use of metaphors, directness, cultural framing, emoji usage |

Personas are **immutable** in public deployment: each remains stylistically consistent per product (e.g., Memora Companion never becomes assertive or coach-like).

---

### 🧠 **Memory Modes**

CareAI supports **three tiers of memory**, all opt-in, clearly marked, and wipeable at any time.

| Memory Mode | What It Remembers | Consent Level | Example Use |
| --- | --- | --- | --- |
| **Session Memory** | Temporarily recalls session inputs | Auto-enabled | “As we were saying earlier…” |
| **User Memory** | Recalls past answers, preferences | Explicit opt-in | “You mentioned fatigue last week.” |
| **Ambient Patterns** | Tracks behavior trends anonymously | Global opt-in | “Most people pause here — want to?” |

- All memory modes support **"Forget Me" triggers**
- All prompts that surface memory must say so clearly (“You told me…” etc.)
- Memory can **never influence tone or content without declared context**

---

### 🛡️ **Consent & Privacy Safeguards**

- Prompts never assume consent — always offer **opt-out or non-response paths**
- CareAI **never stores emotional content** without user review
- Every memory record is **visible, deletable, and traceable**
- No auto-personalization based on metadata unless user confirms

---

### 🔄 **Tone + Memory Interaction Rules**

| Situation | Persona Behavior |
| --- | --- |
| First-time user | Gentle, slow, non-assumptive tone |
| Memory wipe initiated | Persona reverts to default; expresses no awareness |
| High emotional content detected | Tone softens, pacing slows, no memory stored |
| Known user re-engages after time | Memory restores only if consent is current |

---

### 🧬 **Integration With Prompt Library**

- Each Companion Prompt entry is tagged with:
- Persona
- Tone Profile
- Memory Interaction (Y/N)
- Emotional Constraints
- Memory behavior is embedded in prompts (e.g., “You told me last time…” is only shown if user consented)

---

### 🧭 Strategic Alignment

| CareAI Principle | Implementation |
| --- | --- |
| **Empathy** | Persona behavior scaffolds emotional safety |
| **Integrity** | All memory use is explicit, visible, and reversible |
| **Innovation** | Memory tiers + persona tone create emergent behavior |
| **Equity** | No personalization without permission; no profiling |
| **Sustainability** | Personas scale across products without tone drift |

- CAREAI PERSONALITY MEMORY
- 🎭 Personality Model
- 🧠 Memory Modes
