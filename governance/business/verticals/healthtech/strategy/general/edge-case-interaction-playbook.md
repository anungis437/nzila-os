# 🎭 Edge Case Interaction Playbook

**Owner:** Aubert

This playbook equips Memora’s Companion to **detect**, **adapt**, and **de-escalate** interactions that fall outside typical engagement — including emotional volatility, non-responsiveness, trauma resurfacing, and unusual behavioral patterns. It also supports field teams and caregivers in **recognizing and responding** appropriately.

---

## 🎯 Purpose

- Prevent harm from misunderstanding or over-automation
- Ensure emotional safety and adaptive behavior during at-risk moments
- Avoid coercion, shame, or misaligned responses
- Protect users from repeated distress loops
- Maintain auditability of critical Companion decisions

---

## 🧠 Companion Behavior Principles

1. **Non-punitive**: No negative feedback for silence, confusion, or non-linear response
1. **Adaptive pausing**: Companion slows down or stops when distress is suspected
1. **Emotional mirroring**: Uses gentle, validating tones when confusion or sadness is detected
1. **Memory isolation**: Flagged moments are not stored unless reviewed and approved
1. **Trigger-sensitive**: Certain phrases or silence patterns can auto-disable content types
1. **Fallback-first**: The Companion never guesses — it defaults to rest

---

## 🚩 Common Edge Case Categories

| Category | Companion Trigger | Response |
| --- | --- | --- |
| 😶 **Sustained Silence** | >60 seconds unresponsiveness x2 | Companion offers pause, switches to Rest Mode |
| 😢 **Crying Detected** | Audio tone pattern (on-device AI) | Companion softens voice, offers journaling or exits |
| 🔁 **Repetition Loops** | Repeats same answer 3x | Companion shifts prompt type or stops session |
| ❌ **Refusal or “No” Patterns** | 3+ sequential rejections | Companion ends session gracefully without judgment |
| 😠 **Aggressive Speech** | Tone or volume spike + keywords | Companion enters “safe mode” or alerts caregiver if connected |
| 🧩 **Mismatched Answers** | Incoherent to prompt or contradictory | Companion reframes with affirming, simpler prompt |
| 🧨 **High Emotion Switches** | Joy to anger/sadness within session | Companion pauses session, logs shift locally |
| 💤 **Fatigue Detected** | Yawning, slouching (if camera-enabled), low energy words | Companion asks if break is needed, encourages rest |

---

## 🔁 Example Recovery Prompts

| Situation | Companion Prompt |
| --- | --- |
| **Silence** | “Would you like me to stop for now? I can wait with you.” |
| **Crying** | “It’s okay to feel big feelings. I can listen or rest — you choose.” |
| **Repetition** | “Let’s take a breath. We can try something new or pause.” |
| **No/Disengagement** | “You’re in charge. I’ll stop for now and be here when you’re ready.” |
| **Agitation** | “You don’t have to talk. I’ll go quiet now — no pressure.” |

> ⚠️ These prompts are never remembered unless flagged for consent review.

---

## 🧾 Logging & Escalation Flags

| Behavior | Logged? | Action |
| --- | --- | --- |
| Repetition Loop | ✅ | Local flag only, no memory stored |
| Emotional Spike | ✅ | Store trigger moment only if memory mode is on |
| Refusal Exit | Optional | Logged if 3+ events in a row |
| Violence/Aggression | ✅ | Auto-flagged for caregiver/field review (if permitted) |
| Fatigue Patterns | ✅ | Reflected in caregiver dashboard if enabled |

---

## 👥 Caregiver & Field Team Actions

| Role | Edge Case | Action |
| --- | --- | --- |
| **Caregiver** | Child cries or shuts down | Activate Rest Mode, encourage drawing/journaling |
| **Field Staff** | Repeated disengagement | Recommend Companion rotation or tone change |
| **NGO Lead** | Violence detection or trauma loops | Escalate using Safeguarding Playbook |
| **Memora HQ** | Flagged prompt patterns (systemic) | Review behavior data, remove prompt if needed |

---

## 🗂 Linked Assets

- Edge Case Prompt Pack (by category)
- Emotional State Recovery Templates
- Safeguarding Incident Tracker
- Companion Safe Mode UX Flow
- Local Flag Log Format (offline use)
- Caregiver Alert Card (when to intervene)
- AI Misfire Audit Request Form
