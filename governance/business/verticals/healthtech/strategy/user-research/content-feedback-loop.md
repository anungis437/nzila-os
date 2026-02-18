# 🔄 Content Feedback Loop

**Owner:** Aubert

### **1. Purpose**

This document defines how Memora manages the **ongoing validation, refinement, and scaling** of Companion content. It ensures:
- Prompt libraries, tone guidance, and Companion behaviors evolve responsibly
- Content updates reflect **user feedback**, **clinical insight**, and **governance approval**
- All changes are **audited, version-controlled, and consent-aware**

This loop prevents drift from Memora’s ethical standards and ensures messaging remains emotionally safe, accessible, and multilingual.

---

### **2. Content Types Managed**

| Content Type | Examples |
| --- | --- |
| **Companion Prompts** | Game encouragements, nudges, streak recognition |
| **Caregiver Templates** | Suggested messages for shared encouragement |
| **Tone Tags** | Warm, gentle, neutral expansions |
| **Localization Entries** | EN/FR prompt pairs, regionally validated |
| **Behavioral Responses** | Reset, silence, opt-out confirmations |
| **Future Modes** | Seasonal/experimental tone modules (Phase 2+) |

---

### **3. Feedback Channels**

| Source | Frequency | Method |
| --- | --- | --- |
| **User-Initiated Feedback** | Ongoing | In-app prompt: “Was this message helpful?” (Phase 2) |
| **Caregiver Suggestions** | Periodic | Optional survey or dashboard feedback module |
| **Clinical Advisory Input** | Quarterly | Structured prompt/tone review with clinical liaison |
| **QA & Testing Notes** | Per release | Accessibility, flow, and regression test results |
| **Translation Review Logs** | Bi-annual | Tone parity and accessibility audit in French |
| **Governance Board Requests** | As needed | Requests from privacy, compliance, or ethics reviewers |

---

### **4. Content Governance Workflow**
`plaintext
CopyEdit
[ Content Idea or Issue Raised ]
         ↓
[ Intake Tagged: Prompt | Tone | Locale | Policy | Behavior ]
         ↓
[ Review Sprint with UX + Compliance ]
         ↓
[ Draft Created (EN/FR) + Tone Validation ]
         ↓
[ QA Test: Clarity | Accessibility | Policy Fit ]
         ↓
[ Governance Review (if flagged) ]
         ↓
[ Add to Prompt Library / Patch Notes ]
         ↓
[ Deployed via Feature Flag or Silent Release ]
         ↓
[ Change Logged with Version ID ]

`

---

### **5. Change Classification & Review Thresholds**

| Classification | Examples | Review Required |
| --- | --- | --- |
| **Minor Copy Edit** | Typo fix, minor rewording (same tone) | UX Lead |
| **Tone Shift** | Rewriting from neutral to gentle | UX + Compliance |
| **New Prompt** | New ID or context-specific variation | Full review + QA |
| **Localization Addition** | New FR/EN pair | UX + Language Review |
| **Consent-Aware Prompt** | Adds behavior gated by consent | Compliance + Audit |
| **Caregiver-Facing Update** | Any message visible to caregivers | Ethics + Clinical Liaison |

---

### **6. Logging & Versioning Protocol**

| Rule | Implementation |
| --- | --- |
| All prompt updates tracked by `prompt_id` and `version_id` | ✅ Stored in content registry |
| Change rationale attached | ✅ Reason + source noted |
| Audit log updated on every deploy | ✅ Includes who approved + timestamp |
| Deprecated content archived | ✅ No deletions, only version replacement |
| Localization parity enforced | ✅ No EN-only releases allowed |

---

### **7. Safety Net Controls**

| Safeguard | Enforcement |
| --- | --- |
| **Prompt Cooldown** | Newly added prompts cannot fire more than once in 7 days |
| **Consent Tags Required** | Prompts with memory or caregiver tie-ins must have `consent_required: true` |
| **Silent Fallback** | If Companion memory is reset or muted, no new content may be shown |
| **Pre-launch Review Table** | All new content appears in release notes with flagging for localization, compliance, or caregiver visibility |

---

### **8. Evaluation Metrics (Phase 2+)**

| Metric | Description |
| --- | --- |
| Prompt dismiss rate | % of users dismissing vs. engaging with prompt |
| Tone feedback | “Was this helpful?” response breakdown by tone |
| Localization clarity audit | QA rating of translation parity |
| Companion silence rate | % of users toggling to silent mode after prompt delivery |
| Consent-triggered usage | % of prompts gated by memory or caregiver opt-in |

All metrics anonymized and stored in consent-validated analytics stack.

---

### **9. Linked Governance & UX Docs**

- 🗣️ [Prompt Library]
- 🧠 [Companion Behavioral System]
- 🧬 [Memory Graph Reference]
- 🧾 [Language & Tone Guidelines]
- 📋 [Explainability & Control UX Plan]
- 📘 [AI Governance & Ethics Charter]
- 🧪 [Testing & QA Strategy]
- 📊 [Audit Logging Plan]
