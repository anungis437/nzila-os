# 🌱 First-Time User Experience (FTUE)

**Owner:** Aubert

### **1. Purpose**

The FTUE ensures that **first-time users** — especially aging individuals and their caregivers — receive:
- A **calm and clearly paced onboarding flow**
- Transparent **consent collection** (in compliance with Law 25, PIPEDA)
- An introduction to **Companion support**, game types, and user controls
- Built-in **accessibility accommodations** from the start
- A UX that prioritizes **comfort, autonomy, and encouragement** over pressure

---

### **2. FTUE Entry Triggers**

| Platform | Trigger |
| --- | --- |
| Mobile App (Patient) | App opened with no session data |
| Mobile App (Caregiver) | Account creation → prompt to link to patient |
| Tablet (Clinic Onboarding) | Account created by staff → guided flow launches |
| Web (Phase 2) | Future caregiver onboarding view |

---

### **3. FTUE Flow Overview (Patient App)**
`plaintext
CopyEdit
[ Launch ]
   ↓
[ Language Selection ]
   ↓
[ Welcome Message + Accessibility Tip ]
   ↓
[ Consent Collection (Multi-step) ]
   ↓
[ Intro to Companion ]
   ↓
[ Game Overview Carousel ]
   ↓
[ First Companion Prompt ]
   ↓
[ Daily Routine Setup (optional) ]
   ↓
[ Home Screen Launch ]

`

---

### **4. Detailed Step Descriptions**

### A. **Language Selection**

- UI: Two large toggle buttons → “English / Français”
- Persisted in user profile
- Determines language of all FTUE content

---

### B. **Welcome Message**

- Copy (EN): *“Welcome to Memora. Let’s begin gently. You’re in control.”*
- Copy (FR): *“Bienvenue à Memora. Prenons un bon départ, à votre rythme.”*
- Optional tip: *“You can enlarge text later in Settings.”*

---

### C. **Consent Collection**

| Consent | Behavior |
| --- | --- |
| Data Storage & Interaction Logs | Required to proceed |
| Companion Interaction & Nudges | Optional toggle |
| Clinic Linkage (if present) | Shown only if pre-provisioned |
| Data Sharing for Research | Optional toggle with description |
| All consents logged to audit trail | ✅ Law 25 & PIPEDA ready |

---

### D. **Companion Introduction**

- Avatar appears, with soft animation
- Sample prompt: *“Hi there. I’m your Companion. Let’s keep things simple and fun.”*
- Users are informed:
- *“You can mute me anytime.”*
- *“I don’t collect personal health info.”*

---

### E. **Game Type Carousel**

| Game | Description |
| --- | --- |
| Memory Match | “Flip and match the cards” |
| Sequence Builder | “Remember the right order” |
| Category Sorter | “Put things in the right group” |

- No gameplay yet — just preview
- Swipable on mobile, tab-based on tablet

---

### F. **First Prompt + Action**

- Companion: *“Ready to give your memory a gentle boost?”*
- CTA:
- “Let’s Try a Game” (→ Memory Match)
- “Maybe Later” (→ Home screen)

---

### G. **Daily Routine Setup (Optional)**

| Question | UI |
| --- | --- |
| “Want a gentle nudge daily?” | Toggle on/off |
| “Morning or Evening?” | Selectable chips |
| Stored in user settings | ✅ Consent-bound |

---

### **5. Accessibility & Tone Guidelines**

| Area | Rule |
| --- | --- |
| Text size default = 16px; scaling up to 24px | ✅ |
| Buttons/toggles ≥ 44px | ✅ |
| Calm color scheme: teal/gray; no red/yellow | ✅ |
| No gamified pressure | Language: “Try,” not “Start now” |
| Narration-friendly | All steps announced via screen reader |
| Leaf icon used for calm transitions | ✅ Companion visual anchor |

---

### **6. Failure & Retry Patterns**

| Scenario | UX Behavior |
| --- | --- |
| Internet disruption | “We’re having trouble connecting — please try again shortly.” |
| Consent screen skipped | Blocked with calm prompt: “We need this to continue.” |
| User exits midway | Resumes from last completed FTUE step on next launch |

---

### **7. Post-FTUE State**

| Area | Behavior |
| --- | --- |
| Home screen loads | Default = Companion active + game suggestions |
| First badge | Optional: “Welcome badge” earned after 1 session |
| Companion state = `neutral` | No past session or streak memory |
| Settings pre-filled with FTUE choices | Toggleable anytime |

---

### **8. Metrics & Logging**

| Event | Log Type |
| --- | --- |
| FTUE started/completed | Session table |
| Consent choices | Consent Log table |
| Companion first response | Companion Events |
| Game launched from FTUE | Session type = `first_session` |

---

### **9. Linked Documents**

- ✅ [Consent UI Flows]
- 🧠 [Companion Behavioral System]
- 🧪 [UI/UX QA Checklist Template]
- 🧼 [Memory Reset UX]
- 📘 [Language & Tone Guidelines]
- 🗺️ [Screen Reader Path Maps]
- 📋 [Accessibility Implementation Guide]
- 🧱 [Component Library Reference]
