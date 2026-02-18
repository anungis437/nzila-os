# 🔗 Integration Layer Overview

**Owner:** Aubert

> “Connected, secure, and memory-aware — across all endpoints.”

---

### 🎯 Purpose

This layer defines how CareAI interfaces with internal modules, external systems, and user-facing platforms through secure, structured, modular APIs and cross-layer orchestration.

It governs:
- API design and authentication
- Payload tagging and context scoping
- Consent-bound memory actions
- Orchestration with gamified and feedback layers
- External integrations with regulated systems (EHR, LMS, CRM, etc.)

This ensures all integrations support:
- Safety-by-default
- Transparent memory usage
- Tone and persona integrity across systems

---

### 🧱 Integration Roles

| Role Type | Description |
| --- | --- |
| **Persona Interface** | Connects user-facing persona logic to orchestration and UX layers |
| **Memory API** | Fetches, stores, and deletes memory objects with scoped access |
| **Consent API** | Validates opt-in/out status for all memory, gamification, export |
| **Feedback Loop API** | Captures skip events, ratings, and fallback usage across prompts |
| **Gamification API** | Retrieves symbolic progress state and milestone triggers |
| **Fallback Trigger API** | Communicates service status to failover layer |

---

### 📡 Core API Requirements

| Requirement | Enforcement |
| --- | --- |
| **Tokenized Authentication** | All API calls require user-, session-, or persona-scoped JWT |
| **Memory Scope Validation** | No memory request executes unless `persona_scope` + `consent_status` are valid |
| **Contextual Metadata** | Every payload includes `prompt_id`, `persona_id`, `session_type`, and `origin_module` |
| **Latency SLA** | APIs must return within 600ms for live prompts (or fail gracefully) |
| **Retry with Transparency** | Any retries must include flag `retry_reason` and notify UX layer |
| **No Passive Writes** | Data is written only with explicit action, never by inference |

---

### 🧾 Payload Schema Examples

### 1. **Memory Fetch Request**
`{
  "persona_scope": ["Memora"],
  "memory_type": "goal",
  "consent_status": "explicit_given",
  "timestamp_requested": "2025-07-04T14:55Z",
  "access_reason": "Reflection prompt injection",
  "session_id": "abc123-session"
}`

### 2. **Feedback Loop Submission**
`{
  "prompt_id": "prompt_0421",
  "event_type": "skipped",
  "persona_id": "SmartHabits",
  "reason": "too long",
  "timestamp": "2025-07-04T14:58Z"
}`

---

### 🔒 External System Integration Safeguards

| System Type | Guardrail | Status |
| --- | --- | --- |
| **Health Systems (EHR)** | Data stays firewalled unless role, scope, and consent match | ✅ Enforced |
| **LMS / Educational** | Only anonymized progress data can flow outbound | ✅ Enforced |
| **CRM / Messaging** | No contact, demographic, or behavioral profiling allowed | ✅ Enforced |
| **IoT / Shared Devices** | Default to anonymous fallback and Minimal Mode UX | ✅ Enforced |
| **Voice Assistants** | Session memory only; no prompts stored post-session | ✅ Enforced |

> All third-party integrations undergo quarterly review and must complete privacy impact assessments.

---

### 🧯 Failover & Degraded Handling

- All APIs support return object: `{ "status": "degraded", "fallback_prompt": "[ID]" }`
- APIs coordinate with **System Failover Layer** to log retry attempts
- Companion response behavior aligns with governance: *"We're continuing without that feature for now."*

---

### 📋 API Versioning & Rollback

| Version Rule | Enforcement |
| --- | --- |
| `v1`, `v2` etc. appended to all major endpoints | ✅ Required |
| Deprecation notice sent 30+ days in advance | ✅ Required |
| Version rollback plan stored in architecture log | ✅ Required |

---

### 🧭 Strategic Alignment

| Value | How This Layer Delivers |
| --- | --- |
| **Empathy** | Ensures integrations enhance—not interrupt—UX or memory rights |
| **Integrity** | API calls are scoped, consent-checked, and verifiable |
| **Sustainability** | Modular APIs allow system-wide updates without regressions |
| **Interoperability** | Supports secure connection to regulated systems (EHR, LMS, CRM) |
