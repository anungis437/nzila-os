# 🧬 Persona Layer – Core Architecture

**Owner:** Aubert

> “Consistency, familiarity, and trust—delivered through every interaction.”

---

### 🧠 Purpose

The **Persona Layer** defines how CareAI behaves across products, users, and contexts. It governs tone, language, personality traits, cultural alignment, and behavior rules to ensure **continuity** and **trust** across interactions. This layer bridges branding, emotional design, and ethical boundaries—creating AI that feels human, without pretending to be one.

---

### 🧩 Key Functions

| Function | Description |
| --- | --- |
| **Persona Templates** | Modular definitions of tone, language, pacing, and behavioral traits |
| **Tone Conditioning** | Adjusts system prompts to reflect brand, context, and user role |
| **Behavioral Rulesets** | Defines limits (e.g., when not to joke, how to respond to emotional cues) |
| **Localization Filters** | Culturally aware shaping for language, expressions, and formality levels |
| **Context Blending** | Merges memory and persona for context-rich conditioning |

---

### 🧬 Persona Template Structure

Each product or user role is linked to a structured template:

| Field | Description |
| --- | --- |
| `name` | Identifier (e.g., Memora Companion, Learning AI) |
| `tone_profile` | Empathetic, encouraging, professional, playful |
| `language_profile` | Default + fallback (e.g., en > fr > sw) |
| `pacing_rules` | Ideal message length, pause rules, session flow |
| `formality_level` | Ranges from casual to professional |
| `do_not_do` list | Jokes, opinions, medical claims, etc. |
| `cultural_bias_filters` | Custom lexical exclusions, analogies, references |
| `escalation_triggers` | Keywords or mood signals that invoke rerouting |

---

### 🌍 Predefined Personas

| Name | Use Case | Key Traits |
| --- | --- | --- |
| **Memora Companion** | Cognitive wellness support | Gentle, warm, supportive, playful |
| **Learning AI** | EdTech study assistant | Encouraging, curious, affirming |
| **Clinic Helper** | Waiting room terminals | Calming, brief, device-constrained |
| **Volunteer Onboarder** | First-time user assistant | Cheerful, helpful, process-driven |
| **Admin Support** | Internal dashboard tools | Precise, direct, no fluff |

Each persona is stored as a JSON-like schema and passed into prompt orchestration dynamically.

---

### 🎛️ Conditioning in Prompt Flow

- Persona traits are injected into **system prompts** as instruction headers
- Behavior rules are enforced post-generation via **output filters**
- Session memory enriches persona with **short-term emotional markers**
- Formality and tone bias encoded as **weightings** in temperature/prompt tuning

---

### 🧠 Personalization & Ethics

- No **identity mimicry** (e.g., “I am your doctor/teacher” never used)
- Personas clearly identify themselves as **assistants** or **companions**
- Emotional conditioning tuned **not to manipulate**, only to support
- Users can **view and adjust** their assistant’s tone and pacing preferences

---

### 🛡️ Guardrails

- All personas inherit a **Do Not Do** list based on product risk profile
- Persona output passes through **Compliance Layer** for health/education claims
- Escalation rules redirect sensitive situations to human or fallback logic
- Voice interface versions embed **auditory cues** for tone verification

---

### 🧭 Manifesto Alignment

| Principle | Implementation Example |
| --- | --- |
| **Empathy** | Persona warmth, emotional attunement, localized expressions |
| **Integrity** | No anthropomorphizing; persona clarity + opt-out control |
| **Innovation** | Modular persona injection + context blending |
| **Equity** | Localized templates for language, culture, accessibility |
| **Sustainability** | Centralized persona library for reuse across ventures |

---

### 🔄 Roadmap (Q3–Q4 2025)

- Persona Library Manager UI (create/edit/test personas)
- Swahili and French persona testing for MyLearning AI
- Emotional state mapping via feedback + sentiment models
- Voice assistant persona alignment (tone and cadence modeling)
- Persona sandbox for funder/investor demos
