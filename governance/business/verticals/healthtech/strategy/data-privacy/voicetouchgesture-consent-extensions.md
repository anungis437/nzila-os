# 🗣️ Voice/Touch/Gesture Consent Extensions

**Owner:** Aubert

> “Consent applies across channels — no matter how softly it’s spoken.”

---

### 🎯 Purpose

This document outlines how CareAI extends and enforces its consent model across:
- Voice commands
- Touchscreen interactions
- Gesture-based input

It ensures all non-textual interactions respect:
- Memory boundaries
- Prompt safety
- Privacy obligations

---

### 🔐 Consent Extension Model

| Input Type | Default Consent Level | Upgrade Path | Notes |
| --- | --- | --- | --- |
| **Voice** | Session only (default) | Verbal + on-screen confirmation | Timed timeout after inactivity |
| **Touch** | Session or UI-confirmed | Checkbox or toggle confirmation | Always offers visual indicator of state |
| **Gesture** | No memory unless toggled on | Settings page + on-screen feedback | Paired with companion acknowledgment |

> No persistent memory or gamification logic may activate from any of these inputs unless upgraded via consent UI.

---

### 📢 Voice Consent Language Patterns

| Consent Type | Companion Prompt Example |
| --- | --- |
| Memory Opt-In | "Would you like me to remember this for next time?" |
| Gamification Enable | "Should I track your progress and show visual badges?" |
| Export or Erasure | "Say 'Forget everything' or 'Export my data' to continue." |
| Consent Status Check | "You’ve chosen session-only mode. Want to update that now?" |

---

### 🖐️ Touch + Gesture Feedback

| Feedback Type | Example Implementation |
| --- | --- |
| Consent Accepted | Toggle switches state and displays green badge icon |
| Consent Pending | Button is greyed out until touched with visual tooltip |
| Consent Declined | Visual shows memory disabled and gamification off |
| Gesture Ignored (Blocked) | Toast popup: "Gestures are off until enabled in Settings" |

---

### 🛡 Enforcement Architecture

- All inputs are tagged with:
- `input_source`
- `consent_status`
- `persona_scope`
- Memory writes will be blocked at the system layer if:
- `consent_status != explicit`
- `persona_scope` does not allow ambient capture

---

### 📊 Consent Input Logging
`{
  "input_type": "voice",
  "content": "Track this please",
  "consent_upgrade_triggered": true,
  "upgrade_method": "verbal + UI confirm",
  "timestamp": "2025-07-06T03:22Z",
  "persona": "SmartHabits"
}`

---
