# 📚 Insight Visualization UX

**Owner:** Aubert

This module ensures that **emotional intelligence**, **self-awareness**, and **journey progress** are **visualized with clarity, calmness, and dignity**. It supports caregivers and NGO partners in monitoring wellbeing **without surveillance**, and allows users to celebrate progress without pressure.

---

## 🎯 Goals

- Present emotional + cognitive patterns over time in **non-judgmental** ways
- Equip caregivers with **glanceable insights** into engagement and wellbeing
- Support **offline and printable formats** for low-connectivity deployments
- Enable caregivers to provide support without resorting to behavior correction
- Help product teams flag fatigue loops, disengagement trends, and Companion drift

---

## 🎨 Design Principles

| Principle | Description |
| --- | --- |
| 🫧 **Calm Visual Language** | Rounded edges, soft tones, never red/yellow alert styles |
| 🧭 **Guided Interpretation** | Every visual includes micro-copy to help interpret without shame |
| 🪞 **Respectful Ambiguity** | Ambiguous data (e.g. silence) is shown neutrally, not as failure |
| 🎛️ **Consent-Scoped Views** | Different insight depth for caregivers vs product staff |
| 🌀 **Emotional Granularity** | Moves beyond happy/sad to track themes like courage, rest, effort |

---

## 📊 Key Insight Types & Visualization Models

### 🧠 Reflection & Emotional Growth

| Insight | Visualization | Notes |
| --- | --- | --- |
| Reflection Depth | 🌊 Layered Wave Graph | Represents complexity and theme evolution |
| Mood Over Time | 📈 Emoji-Scale Line Graph | Weekly mood snapshots with gentle color scales |
| Expression Type Shift | 📊 Stacked Bar (Emoji → Phrase → Story) | Shows linguistic and emotional expression patterns |

---

### ⏱️ Engagement & Fatigue Patterns

| Insight | Visualization | Notes |
| --- | --- | --- |
| Session Rhythm | 📅 Calendar Heatmap | Tracks session frequency, with fatigue overlays |
| Fatigue Flags | 🛑 Symbol-free Trend Line | Avoids “warning” tones; shows need for pacing |
| Companion Tone Drift | 📉 Tone Sentiment Line | Companion tone tuning trends over months |

---

### 🔁 Memory & Consent Behavior

| Insight | Visualization | Notes |
| --- | --- | --- |
| Memory Toggle Usage | 🔘 Pie or Toggle Timeline | How often user adjusts memory settings |
| Reflection Topics Retained | 🧠 Tag Cloud | Only for users who export memory or review journey |
| Consent Evolution | 📄 Consent Audit Trail (PDF/table view) | Tracks caregiver re-approvals or memory reviews |

---

### 🧑‍🤝‍🧑 Caregiver Sync & Role Cues

| Insight | Visualization | Notes |
| --- | --- | --- |
| CoPilot Sync Activity | 🔄 Loop Icon Timeline | Shows moments where caregiver reviewed or intervened |
| Encouragement Points | 🗨️ Highlight Dots | Caregiver notes, Companion-prompted sharing points |
| Paused Session Context | ⏸️ Quiet Zones Map | Flags when a Companion paused to protect user state |

---

## 📘 UX Delivery Modes

| Mode | Format | Audience |
| --- | --- | --- |
| 🖥️ Companion Dashboard (Clinic) | Embedded UI with filters | Care team |
| 📄 Printed Report | Mood line, emoji graph, word cloud | Caregivers, NGOs |
| 🧾 Graduation Summary | Story-style memory overview | Users, caregivers |
| 📦 Field Kit Companion Sheet | Snapshot inside device packaging | NGO staff |
| 📋 Paper Reflection Log Companion | Draw-your-mood pages, coloring prompts | Users (youth, low-literacy) |

---

## 🔐 Privacy Design Rules

- No insight shows **rankings, comparisons, or scores**
- All visuals generated **on-device**, unless export enabled
- Only caregiver-approved data appears in shared reports
- Reflection contents **never shown verbatim** unless explicitly approved
- Silences and gaps are shown as **rest moments**, not “missed sessions”

---

## 🧰 Tools & Templates

- Mood Graph Generator (with emoji scale)
- Reflection Depth Analyzer (privacy-safe NLP or manual scorecard)
- Printable Insight Sheet Builder (PDF auto-populator)
- Graduation Journey Visual Storybook Template
- Memory Export Insight Composer (for caregiver archive)
- Companion Tone History Chart (UX embeddable)
- Equity-First Visual Language Pack (non-western iconography, soft palette)

---

## 🌱 Sample Insight Visualization Summary (Caregiver View)
`
🧠 Emotional Journey:
- Your child expressed more confidence in February.
- The Companion noticed more curiosity questions by March.
- Mood ranged from “quiet” to “curious” most days.

⏱ Session Rhythm:
- Average 3 sessions/week in January → 1 in March.
- Companion paused twice in March for rest.

💬 Expression Growth:
- Emoji-only in January.
- Full sentence reflections began mid-February.

🔁 Memory:
- You enabled memory view 3x.
- Memory was wiped at graduation.
`
