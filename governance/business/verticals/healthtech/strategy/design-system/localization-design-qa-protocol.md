# 🌍 Localization Design QA Protocol

**Owner:** Aubert

### **1. Purpose**

This protocol governs how Memora's UI is **validated across all localized experiences**, ensuring:
- **No visual regressions** due to French copy expansion
- **Tone and intent** remain equivalent across languages
- **Law 25** bilingual compliance is respected
- **Font scaling and screen reader flows** are preserved in both languages
- Future locales (Phase 3) follow consistent design quality expectations

---

### **2. Applicable Areas**

| Area | Included |
| --- | --- |
| All mobile flows (patient + caregiver) | ✅ |
| Settings, Consent, Legal, and Dashboard views | ✅ |
| Companion prompts and badge notifications | ✅ |
| Game UI and results screens | ✅ |
| PDF/printable assets (if applicable) | ✅ |
| Phase 3 web views | ⏳ Future-ready |

---

### **3. Required Pre-Checks**

| Item | Description | Owner |
| --- | --- | --- |
| Native EN + FR copy locked | No placeholder translations | UX Writer (bilingual) |
| Locales structured via `locales/en.json`, `fr.json` | All dynamic | Engineer |
| Figma designs reviewed in both EN + FR | With copy inserted, not notes only | Design Lead |
| Companion prompt equivalence validated | Tone, structure, and accessibility | Content/Behavioral Lead |
| Legal copy reviewed by compliance counsel | Consent, deletion, data sharing | Privacy Officer / Legal |

---

### **4. Visual QA Checklist (EN/FR)**

| Test | Status | Notes |
| --- | --- | --- |
| All buttons allow for 25–30% string length expansion | ☐ | “Send Encouragement” → “Envoyer un message d’encouragement” |
| Headers scale gracefully across languages | ☐ | No overflow or truncation |
| Modals and confirmation dialogs wrap content correctly | ☐ | Fallback to scroll if needed |
| Tab bars and navigation items fit at `typography.size.md` and `lg` | ☐ | Consider vertical stacking on small screens |
| Tooltips appear fully and clearly in FR | ☐ | No clipping or overlap |
| Badge names and Companion labels are non-truncated | ☐ | Allow wrap for long achievements |

---

### **5. Tone & Meaning Equivalence Checks**

| Flow | Action |
| --- | --- |
| Companion Prompts | Compare EN/FR for tone, length, emotional framing |
| Consent UI | Verify formal language tone in FR — never casual/legal-mismatched |
| Dashboard Wording | Validate that clinic/caregiver dashboards preserve clarity in FR |
| Game Instructions | Ensure instructions use Canadian French idioms, not European |
| Streak and Progress Wording | Avoid pressure-inducing terms in both languages |

---

### **6. Font Scaling & Device Coverage**

| Device | Test |
| --- | --- |
| iOS | Increase font to 200% in both EN and FR; validate button and card layout |
| Android | Test with system-wide language + large text setting |
| Tablet | Test landscape + portrait for modal overflow in FR |
| Companion Bubble | Must not truncate longer FR prompts (“Je suis fier de vous aujourd’hui”) |

---

### **7. Accessibility QA (Localized)**

| Test | Status | Notes |
| --- | --- | --- |
| All `aria-labels` switch to FR when language toggled | ☐ |  |
| VoiceOver/TalkBack reads correct locale strings | ☐ |  |
| All interactive elements labeled in both languages | ☐ |  |
| Consent flows are fully navigable in both EN/FR | ☐ |  |
| Screen reader reads language switch action clearly | ☐ | "Langue sélectionnée : Français" |

---

### **8. Testing & Review Cadence**

| Activity | Frequency | Owner |
| --- | --- | --- |
| Full design QA in EN + FR | Per feature/release | QA Lead |
| Prompt bank audit | Monthly | Content Team |
| Localization regression test | Weekly in staging | DevOps / QA |
| Bilingual UX review of core flows | Bi-weekly | UX Writer (FR) |
| Legal consent language review | Quarterly or upon legal update | Privacy / Legal |

---

### **9. Fallback Behavior Rules**

| Scenario | Behavior |
| --- | --- |
| Missing FR string | Use fallback alert: “Texte indisponible – contactez le soutien” |
| Overflow in FR UI | Use scroll or wrap, never truncate or ellipsis without tooltip |
| String interpolation issues (e.g., date or count mismatches) | Validate locale-aware formatting using `Intl` |
| Incomplete translation in component preview | Do not release; mark component version as `BLOCKED` |

---

### **10. Linked Documents**

- 📘 [Language & Tone Guidelines]
- 🧪 [UI/UX QA Checklist Template]
- 🧯 [Edge Cases & Fail-Safes]
- 🗺️ [Screen Reader Path Maps]
- ♿ [Accessible Components Guide]
- ✅ [Consent UI Flows]
- 🧩 [Component Version Control Registry]
- 🎨 [Design Tokens Specification]
