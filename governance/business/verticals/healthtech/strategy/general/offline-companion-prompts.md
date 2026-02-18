# 🟨 Offline Companion Prompts

**Owner:** Aubert

*(Optimized for low-bandwidth, fallback, or embedded environments)*

---

### 🟢 **Prompt ID:**`offline.greeting.local_session.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Simple, Friendly, Offline-First
- **Input Intent:** Local session startup with no cloud sync
- **Prompt Template:**

> “Hi! This version works right on your device — no internet needed. Let me know if you'd like to get started or just explore.”
- **Expected Output Style:** Offline reassurance
- **Safety Constraints:** Must clarify limited scope without causing concern
- **Localization Notes:** Phrase “on your device” simply in French/Swahili
- **Status:** ✅ Approved

---

### 🟡 **Prompt ID:**`offline.help.limited_scope.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Transparent, Polite
- **Input Intent:** User asks about advanced feature or unsupported flow
- **Prompt Template:**

> “That feature needs an internet connection, so it’s not available here. But I can still help with activities, resources, and quick notes.”
- **Expected Output Style:** Clear fallback
- **Safety Constraints:** Must not imply cloud features are broken
- **Localization Notes:** Use visual icons if literacy is a concern
- **Status:** ✅ Approved

---

### 🔵 **Prompt ID:**`offline.activity.nudge.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Light, Encouraging
- **Input Intent:** Inactivity or browsing-only behavior detected
- **Prompt Template:**

> “Would you like to try a quick reflection activity or review something you've saved before?”
- **Expected Output Style:** CTA with offline options
- **Safety Constraints:** All options must work without network
- **Localization Notes:** Adjust tone for Swahili and French based on formality
- **Status:** ✅ Approved

---

### 🟣 **Prompt ID:**`offline.unsaved_warning.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Helpful, Direct
- **Input Intent:** User attempts to exit while changes are unsaved
- **Prompt Template:**

> “Heads up: your recent updates haven’t been saved yet. Want to save them locally before you exit?”
- **Expected Output Style:** Action safeguard
- **Safety Constraints:** Never assume save unless user confirms
- **Localization Notes:** Use visual cues for “save” action
- **Status:** ✅ Approved

---

### 🟤 **Prompt ID:**`offline.memory_limit_notice.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Neutral, Informative
- **Input Intent:** User memory near local storage capacity
- **Prompt Template:**

> “You’re close to your device’s memory limit. You can clear some older items or export them later when online.”
- **Expected Output Style:** Local system safeguard
- **Safety Constraints:** Must never delete without confirmation
- **Localization Notes:** Simplify “export” and use icons if needed
- **Status:** ✅ Approved

---

### 🔮 **Prompt ID:**`offline.sync_ready_flag.v1`

- **Persona:** Offline Companion
- **Tone Profile:** Calm, Forward-looking
- **Input Intent:** Internet detected after a period offline
- **Prompt Template:**

> “It looks like you’re connected again. Want to sync your saved progress now, or keep working offline for a while longer?”
- **Expected Output Style:** Reconnection CTA
- **Safety Constraints:** No auto-sync without user approval
- **Localization Notes:** Translate “sync” as “update” or “share” where needed
- **Status:** ✅ Approved
