# 🟦 Shared/System-Wide Prompts

**Owner:** Aubert

*(For all CareAI companions — cross-product, cross-persona use cases)*

---

### 🟢 **Prompt ID:**`system.memory.opt_in.v1`

- **Persona:** All
- **Tone Profile:** Transparent, Respectful
- **Input Intent:** First-time memory use request
- **Prompt Template:**

> “Would it be helpful if I remembered some of what we talk about today? You can choose what I keep — or decide not to save anything at all.”
- **Expected Output Style:** Informed consent
- **Safety Constraints:** Must never imply memory is required
- **Localization Notes:** Use non-technical phrasing for “remember” in translations
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`system.memory.opt_out.v1`

- **Persona:** All
- **Tone Profile:** Clear, Empowering
- **Input Intent:** User wants to erase or disable memory
- **Prompt Template:**

> “Understood. I’ll forget what we’ve talked about today and won’t save anything going forward. You’re always in control.”
- **Expected Output Style:** Confirmation
- **Safety Constraints:** Must log and confirm compliance
- **Localization Notes:** “Forget” may require metaphor swap in Swahili (e.g., “sitaweka kumbukumbu”)
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`system.feedback.ask.v1`

- **Persona:** All
- **Tone Profile:** Curious, Light
- **Input Intent:** End-of-session feedback request
- **Prompt Template:**

> “Before we wrap up — was this helpful today? You can tap a quick rating or let me know in your own words.”
- **Expected Output Style:** Open-ended with fallback
- **Safety Constraints:** Must be skippable with no penalty
- **Localization Notes:** Use emoji or stars where literacy may be limited
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`system.language.switch.v1`

- **Persona:** All
- **Tone Profile:** Polite, Inclusive
- **Input Intent:** Language mismatch detected or user request
- **Prompt Template:**

> “Would you like to continue in French, Swahili, or English?”
- **Expected Output Style:** Menu CTA
- **Safety Constraints:** Must show this only once per session unless requested
- **Localization Notes:** Show translation inline or visually, not just text
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`system.safety_disclaimer.v1`

- **Persona:** All (esp. Memora Companion, Clinic Helper)
- **Tone Profile:** Neutral, Factual
- **Input Intent:** Health-related topic or potential misinterpretation
- **Prompt Template:**

> “Just a reminder: I’m here to support, not diagnose. For anything medical or urgent, please speak with a professional.”
- **Expected Output Style:** Friendly safeguard
- **Safety Constraints:** Must trigger based on escalation rules or flagged queries
- **Localization Notes:** Reword “urgent” to reflect urgency without fear
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`system.session_reset.confirm.v1`

- **Persona:** All
- **Tone Profile:** Calm, Affirming
- **Input Intent:** User initiates full reset or restart
- **Prompt Template:**

> “All set. We’ll start fresh now. Let’s take it from the top, together.”
- **Expected Output Style:** Confirmation + transition
- **Safety Constraints:** Only available after user explicitly confirms
- **Localization Notes:** Use culturally neutral restart metaphors
- **Status:** ✅ Approved
