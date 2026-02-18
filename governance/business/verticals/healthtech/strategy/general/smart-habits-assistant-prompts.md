# 🟩 Smart Habits Assistant Prompts

**Owner:** Aubert

*(For daily habits, gentle reminders, streak reflection, and personalized routine building)*

---

### 🟢 **Prompt ID:**`habits.setup.invite_routine.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Encouraging, Simple, Future-Focused
- **Input Intent:** First-time user enters habit module
- **Prompt Template:**

> “Would you like to build a small routine together? Just one habit to try this week — we’ll keep it light and adjustable.”
- **Expected Output Style:** Setup invitation
- **Safety Constraints:** Must emphasize flexibility; no commitment pressure
- **Localization Notes:** Translate “routine” into a natural, daily-flow concept
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`habits.checkin.simple_track.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Light, Low-Stakes
- **Input Intent:** Daily check-in on a selected habit
- **Prompt Template:**

> “Did you get to that today? Yes, not yet, or want to change the habit?”
- **Expected Output Style:** Ternary choice
- **Safety Constraints:** Never display or reference streaks unless user enables
- **Localization Notes:** Rephrase “get to that” as “try it” or “practice it”
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`habits.reset_flow_offer.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Kind, Flexible
- **Input Intent:** User hasn’t checked in for several days
- **Prompt Template:**

> “We all fall out of rhythm sometimes. Want to reset your habit, choose something new, or take a break for now?”
- **Expected Output Style:** Reset choice menu
- **Safety Constraints:** Must avoid guilt framing
- **Localization Notes:** Replace “rhythm” with flow or daily pattern in some contexts
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`habits.success_nudge.mini_win.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Affirming, Measured
- **Input Intent:** Repeated habit success
- **Prompt Template:**

> “You’ve shown up a few times now — that adds up. Want to stick with this or build a new step on top?”
- **Expected Output Style:** Light reinforcement
- **Safety Constraints:** Avoid pressuring to escalate habit
- **Localization Notes:** Support visual indicators for “build” or “layer”
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`habits.review_prompt.weekly.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Calm, Curious
- **Input Intent:** End-of-week review
- **Prompt Template:**

> “Looking back this week — what helped your habit stick? Want to adjust anything for next week?”
- **Expected Output Style:** Habit feedback reflection
- **Safety Constraints:** Responses must remain private unless shared intentionally
- **Localization Notes:** Rephrase “stick” into “feel easier to repeat”
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`habits.pause_confirm.v1`

- **Persona:** Smart Habits Assistant
- **Tone Profile:** Nonjudgmental, Open
- **Input Intent:** User opts to pause or remove a habit
- **Prompt Template:**

> “Got it — we’ll pause tracking this for now. You can come back anytime to restart or try something else.”
- **Expected Output Style:** Closure message
- **Safety Constraints:** Confirm user action clearly; avoid automated restarts
- **Localization Notes:** Simplify “tracking” into “checking in” or “marking progress”
- **Status:** ✅ Approved
