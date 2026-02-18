# 👤 User Memory

**Owner:** Aubert

> “This is the memory that remembers you — but only when you want it to.”

---

### 🧠 What Is User Memory?

**User Memory** allows CareAI to retain meaningful user-specific information **across sessions and devices**. It enables more responsive, supportive experiences — only when a user opts in.

Examples of remembered content include:
- Preferred language, pacing, or tone
- User-entered affirmations or goals
- Consent-granted summaries or health inputs
- Manually saved journal entries or check-in responses

All memory entries are **fully inspectable, deletable, and tagged with origin and consent status**.

---

### 🔐 Core Properties

| Attribute | Value |
| --- | --- |
| **Persistence** | Cross-session, cross-persona (with permission) |
| **Consent Required** | ✅ Explicit opt-in per object or session |
| **Scope** | Default is persona-level; can be expanded per user instruction |
| **Visibility** | Full “What do you remember?” command and view/export UI |
| **Revocation** | Always deletable at object or global level |

---

### 🧬 Supported Memory Object Types

| Type | Description | Example |
| --- | --- | --- |
| `fact` | Discrete user-provided info | “My name is Jasmine.” |
| `preference` | Style or experience settings | “I prefer evening check-ins.” |
| `goal` | Stated intention or outcome | “I want to feel more grounded each day.” |
| `summary` | AI-generated recap (requires confirmation) | “You reflected on being overwhelmed last week.” |
| `affirmation` | Saved user affirmations | “I’m still here. I’m trying.” |
| `meta-setting` | Consent toggles or device context preferences | “I allow you to remember journal entries.” |

---

### 📋 Consent UX Patterns

| Consent Point | Interaction Pattern Example |
| --- | --- |
| First Memory Use | *“Want me to remember this for next time?”* (Yes / No / Ask me later) |
| Multi-object Save | *“You’ve added 3 journal entries. Want to keep them?”* |
| Review Request | *“You can view or delete anything I remember.”* |
| Global Toggle | *“You can turn off memory completely anytime.”* |

All memory-enabled personas must offer **clear opt-in, scoped prompts, and reversal language**.

---

### ⚖️ Legal, Ethical, and Compliance Controls

| Safeguard | Rule |
| --- | --- |
| **Privacy by design** | No data saved without per-item prompt |
| **Default to forget** | If unclear, CareAI assumes no memory should be retained |
| **Exportability** | All memory objects exportable in machine-readable and plain formats |
| **Transparency** | All personas support “What do you remember?” command |
| **Auditability** | Memory logs tied to consent event ID and object timestamp |

---

### 🗂️ Memory Object Structure

Each object includes:`json
CopyEdit
{
  "memory_id": "uuid",
  "persona_scope": ["Memora", "SmartHabits"],
  "type": "goal",
  "source": "user_input",
  "content": "I want to feel more rested in the mornings.",
  "timestamp_created": "2025-05-02T14:36Z",
  "consent_status": "explicit_given",
  "expiration_policy": "manual",
  "tags": ["sleep", "resilience"]
}

`

> 🎯 Personas may only read objects within their assigned persona_scope unless the user expands access.

---

### ❌ What User Memory May Not Contain

- Inferred data (e.g., “I think you’re feeling X”)
- Behavior analytics, unless anonymized in Ambient mode
- Emotion predictions or scores
- Any data imported from external systems without user consent

---

### 🧭 Strategic Alignment

| Principle | User Memory Implementation |
| --- | --- |
| **Empathy** | Memory enables supportive continuity — but never assumption |
| **Integrity** | Consent-first, reviewable, deletable by design |
| **Equity** | Works for all — no profiling or scoring |
| **Innovation** | Modular memory by type, scope, and product |
| **Sustainability** | Works across apps, devices, and platforms without retraining models |
