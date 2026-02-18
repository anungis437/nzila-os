# 🧬 Companion Design Framework

**Owner:** Aubert

> “Every companion is a contract: behavior, tone, memory, and role.”

---

### 🎯 Purpose

This framework defines how CareAI companions are created, structured, approved, and deployed. It serves as the behavioral and technical blueprint for every persona used across reflection, learning, wellness, support, and cognitive engagement.

Each companion is:
- Identity-bound (with tone, pacing, empathy, and authority signatures)
- Memory-scoped and consent-tagged
- Gamification-governed (if applicable)
- Audit-traceable and version-controlled

This framework is referenced by governance, prompt, memory, UX, and audit systems.

---

### 🧠 Companion Design Schema

Each companion must include the following design fields:

| Attribute | Description |
| --- | --- |
| **Persona Name** | Display name used in system + UX |
| **Tone Signature** | 6-dimension tone spec (warmth, formality, directness, etc.) |
| **Empathy Profile** | Behavioral model for validation, mirroring, or neutrality |
| **Authority Level** | 0–4 scale defining decision rights, guidance capacity |
| **Stylistic Parameters** | Sentence length, vocabulary domain, punctuation use, media style |
| **Memory Access Level** | Session / User / Ambient / None |
| **Gamification Role** | Full / Partial / None — includes mechanic eligibility matrix |
| **Fallback Behavior** | Default behavior if prompt not understood or memory unavailable |
| **Crisis Tag Behavior** | What happens if this companion is active during a flagged session |
| **Swap Eligibility** | Approved companions for handoff or routing escalation |

---

### 🔐 Role Segmentation

| Role Cluster | Description |
| --- | --- |
| **Reflection & Journaling** | Deep tone, full empathy, no escalation, reflection XP active |
| **Wellness / Habits** | Gentle nudges, progress tracking, streaks allowed if opted in |
| **Learning / Youth** | Clear pacing, low complexity, gamified mechanics optional |
| **Minimal Mode** | Flat tone, zero memory, no gamification, offline-capable |
| **Emergency / Intake** | Stateless, procedural, memory disabled, no behavioral signature |

---

### 🧪 Companion Validation Checklist

| Area | Validation Item |
| --- | --- |
| **Tone Calibration** | Reviewed with Persona Calibration Toolkit |
| **Memory Access Test** | All memory calls reviewed for consent compliance |
| **Prompt Compatibility** | Library pass rate >90% with scoped prompts |
| **Swap Trigger Behavior** | Defined and tested for user-initiated and fallback swaps |
| **Audit Fields Mapped** | persona_id, tone_id, memory_scope, gamification_flag, version |

---

### 📁 Companion File Structure

Each companion should be version-controlled in the following format:`/companions
  /[persona_id]
    - profile.json
    - tone_signature.yaml
    - approved_prompts.csv
    - gamification_matrix.json
    - fallback_rules.json
    - version_log.md`

---

### 📊 Approval Flow

1. **Drafted by**: AI product / UX / behavioral leads
1. **Reviewed by**: Governance, Compliance, UX Accessibility
1. **Tested via**: Prompt pass rates, skip ratios, and safety reviews
1. **Approved by**: CTO or delegated Product Owner

---

### 🧭 Strategic Alignment

| Principle | How It’s Reinforced |
| --- | --- |
| **Empathy** | Calibrated tone, memory boundaries, and pacing layers |
| **Integrity** | Every behavior is declared, reviewed, and audit-logged |
| **Equity** | Companions exist for low-literacy, neurodivergent, and youth users |
| **Sustainability** | Modular rollout allows persona deprecation or refresh |
