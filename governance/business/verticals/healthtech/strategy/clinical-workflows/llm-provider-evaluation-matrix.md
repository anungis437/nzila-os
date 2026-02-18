# 🧮 LLM Provider Evaluation Matrix

**Owner:** Aubert

> “We don’t choose LLMs — we govern their fit.”

---

### 🎯 Purpose

This matrix evaluates current and emerging LLM providers against Nzila’s enterprise criteria, companion behavioral constraints, regulatory alignment, and model adaptability.

Each provider is assessed across:
- Functional reliability
- Ethical safeguards
- Consent-handling capabilities
- Memory compatibility
- Governance transparency

---

### 📊 Evaluation Table

| Provider | Tone Calibration | Consent Support | Memory Safety | Regulatory Posture | Fallback Handling | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **OpenAI (GPT-4o)** | ✅ Excellent | ✅ Supported | ⚠️ Limited* | ✅ GDPR-aligned | ✅ Stream-ready | Works well for default routing; memory via system-only context |
| **Anthropic (Claude 3)** | ✅ Excellent | ✅ Explicit tokens | ✅ Scoped | ✅ Privacy-forward | ✅ Seamless fallback | Best for tone consistency; slower for large payloads |
| **Mistral** | ⚠️ Needs tuning | ❌ Not native | ❌ Stateless | ⚠️ Under review | ❌ Manual | Good for technical prompts; lacks governance layer |
| **Google (Gemini)** | ✅ Moderate | ✅ Native consent | ⚠️ Partial | ✅ Strong compliance | ✅ OK fallback | Good visual multimodal API; tone variation risk |
| **Meta (LLaMA 3)** | ⚠️ Unverified | ❌ Consentless | ❌ Stateless | ❌ Unregulated | ❌ None | Not deployable without wrap layer |

> *OpenAI does not allow persistent memory use across sessions without system-side orchestration (e.g., CareAI memory engine).

---

### 🛡 Model Selection Rules

| Criterion | Deployment Rule |
| --- | --- |
| Companion tone safe | Only providers with <5% tone drift accepted for reflection use cases |
| Consent scoping required | No companion may deploy to model without memory constraint signaling |
| Crisis-ready fallback | LLM must allow token-level termination or swap injection |
| Regional data compliance | Provider must meet Law 25, GDPR, or HIPAA-lite before any PII routing |

---

### 🔄 Monitoring & Review Cadence

- **Monthly**: Model behavior drift and hallucination flag review
- **Quarterly**: Consent + regulatory compliance mapping
- **Per-deployment**: Companion tone validation pass + fallback simulation

---

This matrix is updated continuously by AI Platform Engineering + Data Governance.
