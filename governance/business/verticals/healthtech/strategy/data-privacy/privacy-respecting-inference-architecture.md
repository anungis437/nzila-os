# 🧩 Privacy-Respecting Inference Architecture

**Owner:** Aubert

### **1. Purpose**

This architecture ensures that any AI- or ML-based inference (e.g., Companion tone adaptation, gameplay pacing, engagement risk scoring):
- Operates within a **clearly defined privacy boundary**
- **Never exposes identifiable data** to model layers or third-party systems
- Runs under strict **consent, explainability, and fallback controls**
- Supports **future learning loops** without compromising user autonomy

---

### **2. Inference Principles**

| Principle | Enforcement |
| --- | --- |
| **Anonymized Signals Only** | No personal identifiers or freeform inputs ever reach ML inference functions |
| **On-Device or Isolated Processing** | Local or containerized logic where possible, never shared context across users |
| **Consent-Bound Activation** | Only perform inference if user has explicitly opted into adaptive behavior |
| **Non-Diagnostic, Non-Emotive** | Models may not classify mental state, emotions, or health risk |
| **Explainable Output Path** | All model-driven changes must have a user-visible rationale (via Companion or UI badge) |

---

### **3. Inference Use Cases (Phase 2+ Candidates)**

| Use Case | Inference Type | Trigger Model |
| --- | --- | --- |
| Adaptive grid sizing (games) | Rule-based scaler or RL-lite | Played sessions, mistake count, streak pattern |
| Companion tone suggestion | Memory vector + tone matcher | Past tone preference, engagement state |
| Fatigue detection | Lightweight behavior classifier | Time of day, session length, prompt dismissals |
| Prompt pacing | Cooldown optimizer | Skip rate, past engagement |
| Caregiver prompt match | Template recommender | Recent patient activity + caregiver input style |

> ❗ No inference may produce outputs related to cognitive ability, emotional state, or risk prediction.

---

### **4. Architecture Overview**
`pgsql
CopyEdit
plaintext
+-----------------------------+
|     Consent-Enforced Data  |
| - session logs             |
| - streak history           |
| - dismissed prompts        |
| - tone selection (manual)  |
+-------------|---------------+
              ↓
+-----------------------------+
|    Inference Layer (Scoped) |
| - Rule engine + ML module   |
| - Memory state & streak map |
| - Adaptive behavior trigger |
+-------------|---------------+
              ↓
+-----------------------------+
|    Output Control Layer     |
| - Companion message renderer|
| - Game config modifier      |
| - Dashboard flag adjuster   |
+-----------------------------+

`

---

### **5. Isolation & Execution Strategy**

| Model Type | Execution Environment | Notes |
| --- | --- | --- |
| Rules-based adaptation | In-app (Companion runtime logic) | No inference engine needed |
| Small models (e.g., tone suggestion) | Backend microservice, single-user scope | No multi-user context, batched scoring disallowed |
| Future embeddings (memory recall) | Indexed per-user in scoped DB | Never exposed to shared vector space |
| Offline learning jobs | Aggregated, anonymized dataset only | Requires board approval, audit logging |

---

### **6. Privacy Boundaries**

| Protection Layer | Control |
| --- | --- |
| **Session anonymization** | UUID-based signals only; decoupled from PII tables |
| **Inference sandboxing** | Each model operates per user; shared inference prohibited |
| **Token-scoped inputs** | Inference requests include session token, consent flag, model version |
| **Output filtering** | Every suggestion must pass content filter before delivery (no LLM freeform) |

---

### **7. Consent Hooks (Enforced)**

| Action | Consent Flag Required |
| --- | --- |
| Run any personalization model | `ml_personalization_enabled: true` |
| Companion reference to past behavior | `memory_mode_enabled: true` |
| Adaptive game difficulty | `adaptive_difficulty_enabled: true` |
| Export for aggregate research | `allow_anonymized_research: true` |

All flags default to `false`. Consent must be collected with timestamp, user UUID, language, and interface used.

---

### **8. Logging & Explainability Enforcement**

| Log Type | Fields |
| --- | --- |
| Inference executed | `user_id`, `model_version`, `timestamp`, `inference_type`, `signal_used` |
| Companion message rendered | `prompt_key`, `trigger_context`, `explanation_visible: true/false` |
| Consent verification | `consent_flag`, `enabled_at`, `triggered_by` |
| Model fallback | If model fails or is turned off, log `default_output_used: true` |

---

### **9. Compliance Mapping**

| Law | Enforcement |
| --- | --- |
| **Law 25** | Consent-bound inference, right to revoke, storage in Canada |
| **PIPEDA** | No unjustified profiling or algorithmic exposure |
| **GDPR (Research)** | Anonymization at collection, no re-identification risk |
| **Internal Charter** | AI Governance Board required to approve all new inference models |

---

### **10. Future Safeguards & Research Controls**

| Capability | Status |
| --- | --- |
| Model registry + versioning | Planned Phase 2 |
| Shadow inference testing | Planned Phase 3 |
| Model fairness audit logs | Optional for clinic/research phase |
| Third-party model review policy | Under Governance Board discretion |

---

### **11. Linked Documents**

- 🧠 AI/ML Model Strategy
- 🧬 Personalization Engine Specification
- 📋 AI Governance & Ethics Charter
- 🔐 [Consent & Privacy Flow]
- 📊 [Data Schema Overview]
- 🧠 [Explainability & Control UX Plan]
- 🛠️ [Monitoring & Incident Response Plan]
