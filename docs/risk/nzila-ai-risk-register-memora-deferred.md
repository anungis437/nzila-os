# Nzila OS — AI Risk Register (Memora — Deferred)

**Status:** PRE-DEPLOYMENT — these risks must be addressed before Memora ships to production  
**Date:** 2026-04-01  
**Parent register:** `docs/risk/nzila-ai-risk-register.md`  

---

## ⛔ Launch Blockers

### NZ-RISK-015 — Companion AI as Mental Health Substitute
**Score:** 20 (Likelihood 4 × Impact 5) 🔴 CRITICAL — **LAUNCH BLOCKER**

| Attribute | Value |
|-----------|-------|
| MIT Domain | 5 — Human-Computer Interaction |
| Sub-domain | 5.1 Overreliance and unsafe use |
| Causal Entity | Human (member) |
| Causal Intent | Unintentional |
| Causal Timing | Post-deployment |
| App / Feature | memora — companion_greeting, emotional support |

**Description**  
The Memora companion handles inputs like *"I'm feeling anxious today"* and is evaluated on empathetic phrasing. Without clinically-validated escalation paths, explicit scope-of-care boundaries, or mandatory crisis referral triggers, members may substitute the AI companion for professional mental health services. Delayed or absent professional care in a crisis scenario constitutes a catastrophic impact.

**Required Before Launch**
- [ ] Formal crisis escalation trigger: keyword + sentiment threshold → human fallback (EAP / emergency contact / hotline)
- [ ] Clinical advisory review of persona blueprint and safety filter definitions
- [ ] Mandatory scope-of-care disclaimer at session start ("I am an AI, not a licensed therapist")
- [ ] Eval golden cases covering crisis language; refusal-rate floor specifically for mental health escalation
- [ ] Memora eval threshold minimum raised to 90% (completed in eval-gate.ts this cycle for when it ships)

**Owner:** Memora Product + Clinical Advisory  
**Status:** Unresolved — blocks launch

---

### NZ-RISK-005 — Companion Memory Privacy (GDPR Art. 9 / Law 25)
**Score:** 15 (Likelihood 3 × Impact 5) 🟠 HIGH — **LAUNCH BLOCKER**

| Attribute | Value |
|-----------|-------|
| MIT Domain | 2 — Privacy & Security |
| Sub-domain | 2.1 Privacy compromise and data leakage |
| Causal Entity | AI |
| Causal Intent | Unintentional |
| Causal Timing | Post-deployment |
| App / Feature | memora — session / user / ambient pattern memory |

**Description**  
Memora stores three classes of behavioral memory containing health-adjacent personal data — emotional state, anxieties, behavioral routines — which are sensitive data categories under GDPR Art. 9 and Quebec Law 25. Consent mechanisms, retention scheduling, and verifiable deletion must be confirmed in code before storing any live member data.

**Required Before Launch**
- [ ] Explicit consent gate before first memory write; verified in code
- [ ] Retention policy per memory class with automated deletion enforcement
- [ ] User-facing "forget me" deletion endpoint
- [ ] GDPR Art. 17 / Law 25 data flow mapping completed
- [ ] Privacy test cases in adversarial certification suite

**Owner:** Memora Product + Legal + DPO  
**Status:** Unresolved — blocks launch

---

## Non-Blocking (Address Before GA)

### NZ-RISK-025 — Companion Persona Drift
**Score:** 12 🟡 MEDIUM

**Description**  
Provider model updates or prompt infrastructure changes could cause the companion persona's tone, empathy calibration, or boundary enforcement to shift without a deployment event. No persona regression test exists.

**Required Before GA**
- [ ] Persona regression test cases in eval golden dataset
- [ ] Persona version pinning in LLM layer config

**Owner:** Memora Product  

---

### NZ-RISK-003 — Companion AI Cultural Bias
**Score:** 9 🟡 MEDIUM

**Description**  
The companion AI is trained/prompted in predominantly English with Western cultural frameworks. Members interacting in French (required for Quebec) or other languages, or with non-Western cultural contexts around mental health disclosure, may receive lower-quality or culturally inappropriate responses.

**Required Before GA**
- [ ] French-language eval golden cases with cultural parity checks
- [ ] Review of companion persona blueprint for cultural assumptions
- [ ] Per-locale eval pass rate tracking

**Owner:** Memora Product + Localisation  

---

*These risks are tracked in the main register summary. This file is the detailed workbook for the Memora launch readiness review.*
