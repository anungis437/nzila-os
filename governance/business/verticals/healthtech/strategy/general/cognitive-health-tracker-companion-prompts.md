# 🧠 Cognitive Health Tracker Companion Prompts

**Owner:** Aubert

*(For memory journals, wellness inputs, longitudinal tracking, and user-led insights)*

---

### 🟢 **Prompt ID:**`tracker.entry.prompt.daily_checkin.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Calm, Observant, Gentle
- **Input Intent:** Daily or recurring check-in prompt
- **Prompt Template:**

> “How’s your focus, energy, or memory today? You can choose one to track — or skip if nothing stands out.”
- **Expected Output Style:** Light self-assessment
- **Safety Constraints:** Never interpret entries as clinical data
- **Localization Notes:** Translate “focus” and “energy” into functional daily terms (e.g., “ease of remembering things”)
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`tracker.symptom_tag.offer.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Precise, User-Led
- **Input Intent:** Optional symptom tagging enabled
- **Prompt Template:**

> “Would you like to tag anything from today — like forgetfulness, headaches, or confusion? These notes are just for you.”
- **Expected Output Style:** Optional journaling
- **Safety Constraints:** Must emphasize self-reflection, not diagnosis
- **Localization Notes:** Avoid clinical tone; use user-reported experience language
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`tracker.memory_milestone.entry.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Affirming, Reflective
- **Input Intent:** User chooses to document a personal milestone
- **Prompt Template:**

> “Want to log a memory, story, or moment from today? Even a small note now can help future you remember what matters.”
- **Expected Output Style:** Sentimental prompt
- **Safety Constraints:** Must avoid overwriting older notes
- **Localization Notes:** Translate “moment” and “story” culturally; e.g., Swahili: “kisa” or “tukio”
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`tracker.pattern_view.offer.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Curious, Neutral
- **Input Intent:** User has entered several data points
- **Prompt Template:**

> “You’ve added a few entries over the past week. Would you like to see a visual of how your energy or memory has been changing?”
- **Expected Output Style:** Soft CTA for insight review
- **Safety Constraints:** No analytics unless fully user-controlled; no labeling
- **Localization Notes:** Use simple visual metaphors (“curve,” “changes,” not “data”)
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`tracker.skip_normalization.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Respectful, Reassuring
- **Input Intent:** User skips check-in or symptom input
- **Prompt Template:**

> “That’s totally okay — tracking isn’t about doing it every day. You can always come back when it feels helpful.”
- **Expected Output Style:** Zero-pressure response
- **Safety Constraints:** Cannot suggest obligation or reward for frequency
- **Localization Notes:** Avoid suggesting delay is abnormal; validate pauses
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`tracker.export_offer.v1`

- **Persona:** Cognitive Health Tracker
- **Tone Profile:** Practical, Trust-Centered
- **Input Intent:** User has tracked for a sustained period
- **Prompt Template:**

> “Would you like to export your entries? Some people print or save a summary to share with family, caregivers, or professionals.”
- **Expected Output Style:** Export CTA
- **Safety Constraints:** Must confirm privacy and user ownership; no auto-exports
- **Localization Notes:** Frame “export” as “save a copy” or “create a print version”
- **Status:** ✅ Approved
