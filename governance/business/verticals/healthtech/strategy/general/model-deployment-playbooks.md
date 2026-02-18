# 🚀 Model Deployment Playbooks

**Owner:** Aubert

> “From validation to production — mapped, modular, resilient.”

---

### 🎯 Purpose

These playbooks define how each CareAI-linked model is:
- Activated across production environments
- Fallback-configured and load-balanced
- Scoped by persona, device class, and memory level
- Versioned and monitored for trust and integrity

Each playbook ensures safe, predictable deployment of CareAI models under real-time load and consent-bound logic.

---

### 📦 Standard Deployment Flow

1. **Validation Passed**
2. Simulation suite complete
3. Persona routing reviewed
4. Tone/empathy locked
1. **Environment Sync**
2. Integration with CareAI Orchestration Layer
3. API and persona-layer contract confirmed
1. **Fallback Map Initialized**
2. Minimal Mode, No-Memory Mode, or Text-Only Route defined
3. Crisis swap protocol scoped per companion
1. **Consent Filter Bound**
2. Default memory mode set per deployment
3. Gamification toggles off by default unless paired with explicit opt-in
1. **Monitoring Activated**
2. Drift detection and hallucination checks enabled
3. Companion tone and prompt performance logged

---

### 🧠 Model Profiles

### 🔹 Memora AI

- **Deployment Type**: Reflection + Cognitive Wellness
- **Memory Mode**: User (opt-in) + Session
- **Fallback**: Minimal Mode + Companion Silence Protocol
- **Gamification**: Off
- **Consent Prompting**: Inline, every 5 sessions

### 🔹 MyLearning AI

- **Deployment Type**: Youth + EdTech Environments
- **Memory Mode**: Session Only by default
- **Fallback**: Safe Simplified Persona or Offline Mode
- **Gamification**: Partial (Level Tracking Only)
- **Consent Prompting**: Guardian Delegation or Device Owner Opt-In

### 🔹 NeuroBridge Speech Engine

- **Deployment Type**: Long-Term Care + Speech Context Inference
- **Memory Mode**: Ambient + Session (with disable override)
- **Fallback**: Text Summary View + Human Supervised Log Export
- **Gamification**: Disabled
- **Consent Prompting**: Session Summary Consent Flow + Staff Escalation

---

### 🔄 Versioning & Rollback Protocol

| Stage | Rule |
| --- | --- |
| `v1.x.x` | Stable deployment version — must pass regression suite |
| `v2.x.x-beta` | Feature upgrade — opt-in pilot environments only |
| `rollback-policy` | Triggered by prompt safety flag or tone drift threshold |
| `failback-default` | Minimal Mode companion + no-memory reroute |

---

### 📊 Deployment Metrics Dashboard (per model)

| Metric | Monitored Value |
| --- | --- |
| Prompt Success Rate | ≥ 90% (intent alignment + tone acceptance) |
| Consent Drift Detection | < 5% consent retraction after activation |
| Fallback Invocation Rate | < 10% in steady-state sessions |
| Memory Access Warnings | 0 if consent not active |
| Swap Delay (persona route) | < 500ms |
