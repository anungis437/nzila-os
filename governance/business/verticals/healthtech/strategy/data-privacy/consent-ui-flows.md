# ✅ Consent UI Flows

**Owner:** Aubert

### **1. Purpose**

This specification governs the **user interface patterns and behaviors** used to:
- Request, confirm, and revoke consent
- Communicate data relationships (e.g., caregiver view, clinic access)
- Avoid coercion, confusion, or “dark patterns”
- Maintain full alignment with **Law 25 (Quebec)**, **PIPEDA**, and **GDPR**

---

### **2. Consent Interaction Principles**

| Principle | Design Rule |
| --- | --- |
| **Affirmative Action Only** | No pre-checked boxes or implicit “next” consent |
| **Reversibility** | Every granted consent has a visible “Revoke” path |
| **Transparency** | Each consent is accompanied by plain-language tooltip or “Learn More” link |
| **Separation of Purpose** | Each consent prompt is visually distinct and purpose-bound |
| **No Penalty UI** | Revoking consent doesn’t degrade unrelated app functionality |

---

### **3. Primary Consent Flows (User-Facing)**

### A. **Initial Consent (First Launch / Onboarding)**

| Step | UX Behavior |
| --- | --- |
| 1. Intro | Calm text + Companion intro animation (if enabled) |
| 2. Consent to store session data | Checkbox (required) + tooltip: “This helps track your progress over time.” |
| 3. Consent to Companion prompts | Optional toggle + CTA: “Turn on Companion Support” |
| 4. Consent to caregiver linking | Optional CTA: “Add someone to cheer you on?” + tooltip |
| 5. Consent to anonymous research | Optional checkbox (not selected by default) + link to privacy policy |
| 6. Proceed Button | Disabled unless required consent is granted |

### B. **Caregiver Consent Path (Post-Onboarding)**

| Path | Flow |
| --- | --- |
| Profile > “Link Caregiver” | Opens modal → “Add caregiver email” → Confirm → Patient reviews & approves |
| Tooltip | “Your caregiver can view summaries, not personal content. You can unlink anytime.” |
| Visual indicator | Label shown: “Linked to caregiver [Name]” + “Unlink” option always visible |

### C. **Clinic Consent (If onboarded via pilot)**

| Path | Shown during onboarding |
| --- | --- |
| Consent required | “This app is offered by your clinic. You can unlink later.” |
| Viewable in Profile | “Clinic Access: Active” with info tooltip + “Disable access” button |
| Unlink trigger | Row greys out in clinic dashboard, confirmation email sent |

---

### **4. Consent UI Components**

| Component | Rules |
| --- | --- |
| Checkbox | Always unchecked by default |
| Toggle | Clear on/off label + distinct from other UI switches |
| Button | “Continue” disabled until required consents are met |
| Modal | Used only for caregiver/clinic link/unlink flows |
| Tooltip | Required for all non-obvious text (e.g., “What does this mean?” link) |
| Icon | Companion status icon updated if prompt consent is revoked (e.g., muted) |

---

### **5. Visual Cues & Status Labels**

| Status | Display |
| --- | --- |
| Consent granted | Label: “Active” (green dot) |
| Consent not granted | Label: “Not Active” or toggle off (gray dot) |
| Consent revoked | Icon: lock with “Access revoked” tooltip |
| Caregiver unlinked | Label shown: “No one linked” |
| Clinic access disabled | Profile label: “Access turned off” — always reversible |

---

### **6. Accessibility & Localization**

| Feature | Standard |
| --- | --- |
| Labels & prompts in EN/FR | ✅ Native authoring only (no auto-translation) |
| Tooltips must be keyboard-accessible | ✅ |
| Screen reader flow for modals | `aria-label` and `aria-describedby` required |
| Touch targets ≥ 44px | ✅ |
| Font scaling & contrast WCAG 2.1 AA compliant | ✅ |

---

### **7. Revocation Flows**

| Type | Revoke UI Location | Result |
| --- | --- | --- |
| Caregiver access | Profile → “Unlink” → Confirm modal | Dashboard deactivates |
| Companion prompts | Profile → Toggle off | Silent mode UI activated |
| Clinic access | Profile → “Disable clinic access” | Clinic row disabled |
| Research data | Profile → “Withdraw research sharing” | Future exports excluded |
| Full deletion | Profile → Request deletion → Confirm → Account purged (handled in Privacy Flow) |  |

---

### **8. Fail-Safes & Edge Case UX**

| Scenario | UI Behavior |
| --- | --- |
| User revokes all consents | App enters minimal mode (playable, no Companion or sharing) |
| User tries to access caregiver while unlinked | Modal: “Link a caregiver to access this view.” |
| Caregiver requests access | Requires patient confirmation via in-app UI |
| Consent expires (pilot ended) | Label: “Clinic access expired” → CTA: “Renew if needed” |

---

### **9. Linked Documents**

- 📋 [Consent & Privacy Flow (Infrastructure)]
- 🧱 [Component Library Reference]
- 🧠 [Companion Behavioral System]
- 📘 [Language & Tone Guidelines]
- 📋 [Accessibility Implementation Guide]
- 🧯 [Edge Cases & Fail-Safes]
- 🧪 [UI/UX QA Checklist Template]
