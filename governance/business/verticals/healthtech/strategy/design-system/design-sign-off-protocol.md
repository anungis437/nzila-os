# ✍️ Design Sign-Off Protocol

**Owner:** Aubert

### **1. Purpose**

This protocol formalizes the process of **reviewing, approving, and locking UI/UX designs** across Memora’s patient, caregiver, and clinic platforms. It ensures:
- Designs are **aligned with accessibility**, **tone**, and **functionality expectations**
- **Cross-team visibility** on final designs (Product, Engineering, QA, Clinical, Legal)
- Each release is governed by a **repeatable, defensible design lifecycle**

---

### **2. Applicable Scope**

| Scope Area | Applies To |
| --- | --- |
| All MVP features | ✅ Core game flows, Companion UI, Settings, Dashboard |
| Phase 2+ Enhancements | ✅ Post-launch features (badges v2, fatigue recovery, narration) |
| Language Localization | ✅ English and French screens |
| Accessibility & Compliance | ✅ WCAG 2.1 AA, Law 25, PIPEDA |
| Visual & Interaction Design | ✅ Typography, layout, motion, tone |

---

### **3. Sign-Off Stages**

---

### **Stage 1: Design Finalization**

| Action | Owner |
| --- | --- |
| High-fidelity mockups complete in Figma | Lead Designer |
| All components reference Design Tokens | Designer + Engineer |
| Edge cases and states documented | UX Writer + QA |
| Localization review (EN/FR copy locked) | Bilingual UX Reviewer |
| Companion prompts approved for tone | Content Lead |

✅ *Checklist:*
- All components documented in Notion or Figma Spec
- Copy tone validated by Content
- i18n string IDs present
- Accessibility labels defined

---

### **Stage 2: Cross-Functional Review**

| Review Area | Stakeholder |
| --- | --- |
| Product consistency & feature alignment | Product Owner |
| Technical feasibility | Frontend Engineer |
| Accessibility audit (WCAG 2.1 AA, VoiceOver/TalkBack) | A11y Reviewer |
| Privacy, consent, and legal language | Legal/Privacy Lead |
| Clinical review (if applicable) | Clinical Partner (e.g., RNH) |

✅ *Checklist:*
- Screens reviewed on mobile + tablet
- Contrast and tap target tests passed
- Consent UI matches Law 25 checklist
- Companion logic represented accurately

---

### **Stage 3: QA Readiness**

| Requirement | Outcome |
| --- | --- |
| Hand-off via Figma + Notion | Final design spec shared with Dev & QA |
| All flows mapped to QA Checklist Template | QA Lead confirms readiness |
| UI/UX QA sessions scheduled | Product + QA coordination |
| Visual regression baselines created | DevOps / QA tool setup (e.g., Percy/Chromatic) |

✅ *Checklist:*
- Designs marked “READY FOR DEV” in Figma
- Jira or task system linked to final screens
- QA tags scenarios by screen
- Testable states documented

---

### **Stage 4: Design Sign-Off Ceremony**

| Format | Action |
| --- | --- |
| Notion Checklist / Shared Doc | All stakeholders digitally confirm sign-off |
| Optional async review | If stakeholders unavailable live |
| Final Figma file version locked | Marked as “Approved” with date |
| Slack/email summary posted | Recap with version number + stakeholder approvals |

✅ *Checklist:*
- All checkboxes marked complete
- Approvals recorded with initials/date
- Screens archived for future reference
- “Design Debt” items (if any) recorded in backlog

---

### **4. Design Sign-Off Template (Summary Table)**

| Reviewer | Area | Approval | Date | Notes |
| --- | --- | --- | --- | --- |
| Product Owner | Feature Scope | ✅ | [ ] |  |
| UX Lead | Layout + Flow | ✅ | [ ] |  |
| Engineer | Feasibility | ✅ | [ ] |  |
| QA | Testability | ✅ | [ ] |  |
| Content/Tone | Companion Voice + Copy | ✅ | [ ] |  |
| Privacy/Legal | Consent + PII UX | ✅ | [ ] |  |
| Clinical (if needed) | UX Alignment | ✅ | [ ] |  |

---

### **5. Linked Documents**

- 🧪 [UI/UX QA Checklist Template]
- 📋 [Accessibility Implementation Guide]
- ✅ [Consent UI Flows]
- 📘 [Language & Tone Guidelines]
- 🧱 [Component Library Reference]
- 🖼 [Screen Reader Path Maps]
- 🧯 [Edge Cases & Fail-Safes]
