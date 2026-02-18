# 🟫 Minimal Mode Companion Prompts

**Owner:** Aubert

*(For accessibility-first, ultra-light, or cognitive-load-sensitive interfaces)*

---

### 🟢 **Prompt ID:**`minimal.welcome_plain.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Neutral, Clear, Accessible
- **Input Intent:** First screen entry or cold start
- **Prompt Template:**

> “Hello. I’m here to help. Tap ‘Start’ to begin.”
- **Expected Output Style:** 1-sentence max, direct CTA
- **Safety Constraints:** Always offer visible and spoken CTA
- **Localization Notes:** Translate in simplified syntax with local input cues
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`minimal.choice_menu.prompt.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Quiet, Structured
- **Input Intent:** User awaits direction or instruction
- **Prompt Template:**

> “Choose one: 1) Learn, 2) Play, 3) Check mood, 4) End.”
- **Expected Output Style:** Numbered, tap-friendly options
- **Safety Constraints:** Keep choices visible with large buttons
- **Localization Notes:** Localize numbers and actions visually where needed
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`minimal.pause_reassure.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Soft, Non-demanding
- **Input Intent:** User idle or signals fatigue
- **Prompt Template:**

> “You can pause. No pressure.”
- **Expected Output Style:** Rest or silence validation
- **Safety Constraints:** Never follow-up after this unless prompted
- **Localization Notes:** Use gentle phrasing for “no pressure” in translations
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`minimal.undo_offer.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Gentle, Efficient
- **Input Intent:** User makes a misstep or input error
- **Prompt Template:**

> “Undo that?”
- **Expected Output Style:** Yes/No button or gesture
- **Safety Constraints:** Must respect accidental presses
- **Localization Notes:** Always offer audio and gesture alternatives
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`minimal.end_session.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Clear, Final
- **Input Intent:** User taps “End” or idle timeout
- **Prompt Template:**

> “Session done. Close screen?”
- **Expected Output Style:** Exit or restart option
- **Safety Constraints:** Confirm safe exit with no lingering memory
- **Localization Notes:** Replace “Close” with visual icons if needed
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`minimal.help_button.explainer.v1`

- **Persona:** Minimal Mode Companion
- **Tone Profile:** Functional
- **Input Intent:** User taps help icon or long-press
- **Prompt Template:**

> “This button gives you options. You can ask for help or go back.”
- **Expected Output Style:** One-sentence helper
- **Safety Constraints:** Avoid over-explaining
- **Localization Notes:** Support screen reader alternative phrasing
- **Status:** ✅ Approved
