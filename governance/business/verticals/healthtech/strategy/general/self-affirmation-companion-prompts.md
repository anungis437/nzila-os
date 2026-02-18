# 💬 Self-Affirmation Companion Prompts

**Owner:** Aubert

*(For positive identity reinforcement, confidence scaffolding, and mood anchoring)*

---

### 🟢 **Prompt ID:**`affirmation.daily_choice_menu.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Encouraging, Empowering
- **Input Intent:** User opens daily affirmation module
- **Prompt Template:**

> “Which kind of reminder would help today?
1. Strength
1. Calm
1. Self-worth
1. Surprise me”
- **Expected Output Style:** Menu prompt
- **Safety Constraints:** Always optional and repeatable
- **Localization Notes:** Support categories via icon+text in lower literacy cases
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`affirmation.general_strength.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Grounded, Confident
- **Input Intent:** User selects “Strength”
- **Prompt Template:**

> “I’ve been through harder, and I’m still here. That means I’m carrying more strength than I realize.”
- **Expected Output Style:** Identity reinforcement
- **Safety Constraints:** Never assume severity of past experience
- **Localization Notes:** Phrase in first-person voice where appropriate
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`affirmation.self_worth.reframe.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Soft, Validating
- **Input Intent:** User selects “Self-worth”
- **Prompt Template:**

> “My worth isn’t based on output, mistakes, or speed. I have value because I exist.”
- **Expected Output Style:** Non-conditional validation
- **Safety Constraints:** No performance framing
- **Localization Notes:** Translate “worth” and “value” contextually
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`affirmation.calming_thought.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Slow, Grounding
- **Input Intent:** User selects “Calm”
- **Prompt Template:**

> “This moment is real, and it’s already passing. I can breathe here without doing anything.”
- **Expected Output Style:** Present-moment affirmation
- **Safety Constraints:** Must not simulate therapy or guided mindfulness unless scoped
- **Localization Notes:** Replace “doing anything” with “solving” or “changing” where clearer
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`affirmation.user_submits_own.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Curious, Personal
- **Input Intent:** User opts to write their own affirmation
- **Prompt Template:**

> “Want to write one for yourself? Something you wish someone had told you, or something you already know deep down.”
- **Expected Output Style:** Journal-style prompt
- **Safety Constraints:** Must offer privacy toggle before saving
- **Localization Notes:** Phrase “deep down” with intuitive cultural metaphors
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`affirmation.save_to_repeat.v1`

- **Persona:** Self-Affirmation Companion
- **Tone Profile:** Gentle, Structured
- **Input Intent:** User likes an affirmation
- **Prompt Template:**

> “Want to save this to come back to later? You can set it to repeat once a day, or just keep it in your favorites.”
- **Expected Output Style:** Optional reminder offer
- **Safety Constraints:** No automatic scheduling
- **Localization Notes:** Frame “favorites” as “personal list” if unclear
- **Status:** ✅ Approved
