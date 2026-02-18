# 🧬 Companion Reintroduction Script (Loss Recovery)

**Owner:** Aubert

This script is used when a **Companion relationship is interrupted** — due to device failure, long gaps in use, field rotation, or user distress. Its goal is to **gently reestablish trust**, **validate memory gaps**, and give the user control over **what to restore, what to forget, and how to begin again**.

---

## 🤲 When to Use This Script

| Scenario | Trigger |
| --- | --- |
| 📦 Device Replaced | Original Companion was lost, reset, or physically swapped |
| 💤 Long Inactivity | 30+ days of no use, with emotional distance or regression |
| 🔁 Program Restart | Youth or caregiver re-enrolls after dropout or pilot end |
| 🚫 Memory Loss | Technical issue causes memory layer to fail or erase |
| 🔁 Returned Companion | Device with partial memory is reassigned to same user |

---

## 🗣️ Script (Spoken by Companion or Read by Caregiver)

> “Hi again. I’m glad we’re together.”

“It’s okay if I feel a little different. Some things may be new for both of us.”

“Would you like me to remember our past times, or start fresh?”

*[Two options shown: "Remember Before" / "Start Fresh"]*

---

### 🟢 If the user selects **"Remember Before"**

> “Thanks. I’ll do my best to carry what we shared — like your favorite stories or how you like to speak.”

“If anything feels off, you can always help me fix it.”

“Let’s pick up where we left off, gently.”

→ Companion loads available memory graph (if stored locally or re-linked securely)

→ Highlights familiar tones, past reflection themes, or pacing preferences

→ Asks user to confirm or update if needed (“Do I still sound right to you?”)

---

### ⚪ If the user selects **"Start Fresh"**

> “That’s okay. We can begin again — softly.”

“I won’t try to remember the past, unless you ask me later.”

“You’re always in control of what we remember.”

→ Memory graph cleared or archived

→ Companion behaves in default onboarding tone

→ Caregiver receives optional alert to prompt reconsent (printed or digital)

---

## 🧭 Reintroduction Options (UX Design)

| Element | Type | Behavior |
| --- | --- | --- |
| 🔘 Memory Choice | Visual toggle ("Remember" / "Fresh Start") | Required to proceed |
| 🎨 Voice & Avatar Confirmation | “Do I still sound/look right?” | Optional adjustment |
| 🧠 Memory Snippets (if available) | “Last time, we talked about…” | Review & confirm, not forced |
| ✍️ Reflection Restart | “Want to start a new journal today?” | Soft re-engagement |

---

## 👥 Caregiver Script (Printed or Spoken)

> “You’ve met this Companion before. It remembers some of what you liked — but only if you want it to.”

“We can ask it to start over, or try to remember things we did before.”

“You decide how we begin again.”

> “If you want to change its voice, we can do that too.”

---

## 🧰 Tools to Support Reconnection

| Tool | Description |
| --- | --- |
| **Avatar Memory Card** | Visual reminder of the Companion’s name and tone (kept from last session) |
| **Companion Memory Summary** | Text or visual log of last 3 saved sessions (if user chooses to recover) |
| **Reflection Archive** | Paper or app-based version of past mood prompts (shared with caregiver) |
| **Recovery Consent Toggle** | Printed or digital form reaffirming memory settings post-return |

---

## 🛡️ Privacy & Safeguards

- 🧼 No memory is restored without **explicit user or caregiver choice**
- 🧾 All restored content is **display-only first** — nothing reactivated silently
- 🧭 Reintroduction triggers optional **new consent check**
- 🔒 If no stored memory exists, Companion offers emotional continuity only (e.g., “I’m still here for you”)

---

## 🗂 Linked Templates & Scripts

- Reintroduction Dialog Copy (UX JSON or prompt set)
- Recovery Mode Toggle Component
- Companion Voice Reset Flow
- Caregiver Consent Reconfirmation Sheet
- Avatar Re-Pair Card
- Memory Summary Sheet Generator (PDF / in-app)
- Re-entry Journal Page (paper / digital)
