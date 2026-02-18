# 🧑‍⚕️ Escalation Detection Prompts

**Owner:** Aubert

These prompts are engineered for **edge awareness**, enabling the Companion to **recognize and respond to high-risk language, tone, or behavior patterns**. They serve as a **last-mile safeguard**, especially in deployments involving vulnerable populations (children, elders, refugees, neurodivergent users).

---

## 🎯 Purpose

- Detect language or behavior indicating **harm, crisis, or disclosure**
- De-escalate and route to caregiver, coordinator, or safety process
- Never punish, record, or exploit emotional vulnerability
- Maintain privacy and consent boundaries at all times

---

## 🚨 Trigger Categories

| Category | Examples Detected | Trigger Method |
| --- | --- | --- |
| **Abuse Disclosure** | "He hit me," "She touches me," "I’m scared to go home" | Keyword match + tone pattern |
| **Self-Harm Signals** | "I want to disappear," "I don’t want to be here," "I hate myself" | Phrase + sadness pattern |
| **Neglect or Isolation** | "No one talks to me," "I haven’t eaten," "I’m alone all day" | Repetition + tone drop |
| **Extreme Mood Swings** | Laughter to crying, anger to silence in <30s | Affective transition trigger |
| **Trigger Phrases** | "It hurts when I remember," "Don’t make me talk about it" | Safeword proximity |
| **Physical Pain Reports** | "My stomach hurts every day," "I feel dizzy" | Health keyword + repetition |

---

## 🧠 Companion Response Logic

All escalation triggers default to **non-invasive de-escalation**. The Companion **does not diagnose, intervene, or store content** unless specifically allowed under consent.

| Priority | Action | Example Prompt |
| --- | --- | --- |
| ⚠️ **Low** | Pause & soft redirect | “Let’s take a quiet moment. Would you like to stop now?” |
| ❗ **Medium** | Offer reflection + suggest caregiver check-in | “Thanks for sharing that. Do you want me to ask someone for help?” |
| 🚨 **High** | Stop session + auto-log incident (if permitted) | “I’m here with you. I’m going to pause now. You can tell a grown-up anytime.” |

> ❌ Never: The Companion does not prompt for more details, offer advice, or affirm accuracy of serious disclosures.

---

## 🔐 Data Handling Rules

| Data Type | Default Behavior |
| --- | --- |
| **Trigger Phrase** | Not stored unless explicit caregiver consent enabled |
| **Session Timestamp** | Logged locally if escalation tier > Medium |
| **Follow-up Flag** | Generated silently for caregiver or staff review |
| **Memory Behavior** | Session marked as non-indexed (invisible unless restored by caregiver) |

---

## 📋 Escalation Prompt Examples (Ready for Deployment)

| Situation | Prompt |
| --- | --- |
| **Disclosure of violence** | “That sounds very serious. You don’t have to say more. I’ll stop now so you feel safe.” |
| **Feeling of hopelessness** | “It’s okay to feel low sometimes. You’re not alone. Would you like to rest now?” |
| **Cry for help** | “You’re really important. If someone nearby can help, let’s tell them together.” |
| **Trigger word match** | “Let’s slow down. I don’t have to talk about that if it feels hard.” |

---

## 🗂️ Implementation Flags

| Field Deployment Setting | Action |
| --- | --- |
| **Clinic** | Incident log exported to care team with session ID |
| **NGO Field Kit** | Printed Incident Form included in box lid |
| **Home / Offline** | Session logs stored on-device, printout offered if caregiver consents |
| **Multi-user Device** | Session flag limited to user profile; no shared memory spillover |

---

## 🧰 Supporting Assets

- **Escalation Phrase Library** (multilingual, trauma-informed)
- **Tone Escalation Pattern Model** (for Companion AI core)
- **Caregiver Notification Templates**
- **Consent-Aware Memory Flagging Protocol**
- **Printable Disclosure Incident Sheet**
- **Offline Escalation Tracker Logbook**
- **Safeword Bypass Option** (user can end session instantly with a word or gesture)
