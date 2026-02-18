# ✍️ Prompt Authoring Workflow & Moderation Queue

**Owner:** Aubert

Memora’s Companion relies on carefully crafted prompts — written in multiple languages, tones, and contexts — to guide learning, reflection, memory, and care. This workflow governs how prompts are created, reviewed, approved, translated, and monitored post-deployment to ensure **consistency, safety, and dignity** in every user interaction.

---

## 🎯 Goals

- Ensure all prompts are **purpose-aligned**, **tone-matched**, and **ethically sound**
- Enable multilingual, culturally attuned authoring with **trauma-aware filters**
- Maintain clear audit trails for versioning, edits, moderation, and red flags
- Allow for **studio-level oversight** with local partner feedback integration
- Prevent prompt drift, ethical mismatches, and overexposure to triggering content

---

## 🛠️ Authoring Workflow (End-to-End)

| Stage | Action | Owner |
| --- | --- | --- |
| 📝 **Prompt Drafting** | Draft prompt with metadata: tone, audience, goal, language | Prompt Author (internal or partner) |
| 🔍 **Peer Review (Stage 1)** | Initial review for clarity, structure, goal fit | Studio QA Reviewer |
| 🛡️ **Ethical Screening (Stage 2)** | Checks against trauma triggers, neurodivergence flags, tone misalignment | Ethics QA Team |
| 🌐 **Localization Pass** | Translate and adapt for region/language — not literal translation | Localization Manager |
| 🔄 **Companion Simulation Test** | Prompt tested in Companion emulator for voice rendering + flow impact | Behavioral QA |
| ✅ **Final Approval** | Locked for deployment; tagged by region, Companion mode, version | Studio Lead |
| 🧾 **Deployment Assignment** | Added to Prompt Library subset(s) by module (e.g. Resilience, Grief, Curiosity) | Product Ops |

---

## 🧾 Prompt Metadata (Logged Per Entry)

| Field | Description |
| --- | --- |
| ✍️ Author | Name, date, role |
| 🧠 Goal | Cognitive / Emotional / Reflective / Learning |
| 🎭 Tone Tag | Gentle, Uplifting, Curious, Reassuring, Culturally Neutral |
| 🧩 Prompt Type | Open-ended, Reframing, Anchoring, Directive, Playful |
| 🌍 Language & Region | e.g., Swahili – Kenya; French – Quebec; English – Urban Canada |
| 🔒 Privacy Tier | Public / Shadow / Private |
| 🛡️ Trigger Review Score | 0–3 risk score (automated + human screening) |
| 📘 Companion Mode | Youth, Elder, Grief Support, etc. |

---

## 🧭 Moderation Queue System

All new or edited prompts enter a moderation queue before being eligible for deployment.

| Queue Type | Contents |
| --- | --- |
| 🚦 **Draft Queue** | New prompts awaiting peer review |
| 🧪 **Test Queue** | Prompts passing peer review, undergoing Companion simulation |
| ⚠️ **Ethics Queue** | Prompts flagged for content concern (internal or field-sourced) |
| 🌀 **Localization Queue** | Prompts ready for or awaiting translation |
| 🔁 **Version Review Queue** | Legacy prompts up for update, tone re-calibration, or archival |
| ❌ **Rejection Bin** | Deleted or archived prompts (never deployed) |

> Queue activity is tracked by prompt ID, status, reviewers, and timestamp.

---

## 📌 Prompt Lifecycle States

| State | Description |
| --- | --- |
| ✍️ Draft | In authoring or awaiting peer review |
| 🔍 In Review | Under moderation (Stage 1 or 2) |
| 🧬 Localizing | Approved but pending region/language adaptation |
| ✅ Approved | Live in one or more Companion flows |
| 🔁 Under Revision | Pulled for tone drift, field flag, or misfire |
| ❌ Archived | Retired and replaced |
| 🚫 Rejected | Removed for failure to meet tone/ethics standards |

---

## 🧠 Companion Voice Sim Preview

Each prompt undergoes **real-time voice rendering** using Companion tone packs before deployment to test:
- Sentence cadence
- Emotional balance
- Multi-prompt transitions
- Fit with memory anchors
- Natural UX flow for children, elders, multilingual users

> Misfires here auto-route back to moderation.

---

## 📊 Analytics & Drift Detection

| Metric | Description |
| --- | --- |
| 📈 Usage Frequency | How often prompt is triggered across deployments |
| 💬 Reflection Match Rate | % of user responses engaging with prompt as intended |
| ⚠️ Misfire Reports | Field tags for confusion, disengagement, or distress |
| 🎯 Impact Weighting | Based on follow-through, emotional response, session continuation |
| 🔁 Drift Score | Deviation from original tone over time (based on Companion logs + NLP scan) |

---

## 🔁 Feedback Loop Integration

Prompts flagged by:
- NGO field staff
- Caregivers or users (via optional UX triggers)
- Studio QA post-deployment reviews
- Companion tone drift logs

…are automatically re-routed to the **Ethics Queue**, tagged for moderation, and paused if severity meets threshold.

---

## ✅ Readiness Checklist Before Deployment

| Checkpoint | Status |
| --- | --- |
| Peer review signed off | ✅ |
| Ethics risk < 2 | ✅ |
| Companion tone tested | ✅ |
| Localization approved | ✅ |
| Field use scope tagged | ✅ |
| Prompt ID and metadata logged | ✅ |

---

## 🗂 Prompt Libraries by Module (Examples)

- 🎒 Youth Curiosity & Confidence
- 🌱 Emotional Recovery & Reflection
- 🧭 Trauma Navigation & Anchoring
- 📘 Literacy Growth & Learning Motivation
- 🧓 Dementia Routine & Safety
- 🧠 Grief Processing & Memory Loop
- 🗣 Multilingual & Culturally Adaptive Frames
