# AI Lifecycle Gates

**Doc ID:** AI-LCG-2026-001
**Version:** 1.0
**Authority:** [ai-policy.md](ai-policy.md) §8

Extends the standard SDLC defined in
[`../security/APPLICATION_SECURITY_POLICY.md`](../security/APPLICATION_SECURITY_POLICY.md)
with AI-specific gates. Every AI surface must clear the gates appropriate
for its risk tier.

## Gate matrix

| Gate | Tier 3 Minimal | Tier 2 Limited | Tier 1 High |
|------|:--------------:|:--------------:|:-----------:|
| G1. Risk classification recorded | ✅ | ✅ | ✅ |
| G2. Inventory entry | ✅ | ✅ | ✅ |
| G3. PIA / DPIA | ✓ if any personal data | ✅ | ✅ |
| G4. AIGC approval | n/a | n/a (Privacy Lead) | ✅ |
| G5. Reasoning context envelope wired | recommended | ✅ | ✅ |
| G6. User-facing AI disclosure | n/a | ✅ | ✅ |
| G7. Eval suite (intent / accuracy / refusal) | recommended | ✅ | ✅ |
| G8. Bias eval | n/a | ✓ if user-facing | ✅ |
| G9. Adversarial / prompt-injection test | recommended | ✅ | ✅ |
| G10. Human-in-the-loop documented | n/a | ✓ if action paths | ✅ |
| G11. Conformity dossier | n/a | n/a | ✅ |
| G12. Cost / token budget configured | ✅ | ✅ | ✅ |
| G13. Observability + correlation id | ✅ | ✅ | ✅ |
| G14. Incident playbook addendum | n/a | ✓ | ✅ |
| G15. Rollback / disable kill-switch | ✓ | ✅ | ✅ |
| G16. Post-launch monitoring plan | ✓ | ✅ | ✅ |

## Gate definitions

### G1 — Risk classification recorded
Apply [risk-classification.md](risk-classification.md) §2 rubric. Record in
the inventory and surface README.

### G2 — Inventory entry
Add row to [inventory.md](inventory.md) with all schema fields populated.

### G3 — PIA / DPIA
Use [`../privacy/ai-pia/template.md`](../privacy/ai-pia/template.md) for
AI-specific dimensions. For non-personal-data AI use the general DPIA
template in [`../privacy/dpia/template.md`](../privacy/dpia/template.md).

### G4 — AIGC approval
Required for Tier 1. Quorum per [governance-committee-charter.md](governance-committee-charter.md).
Decision recorded in committee minutes and inventory.

### G5 — Reasoning context envelope
Every model call carries a structured envelope (model, version, prompt
template hash, retrieved evidence ids, parameters, request id) that is
persisted with the response. Enforced by contract test in
`tooling/contract-tests/` (TODO add `ai-reasoning-envelope.test.ts`).

### G6 — User-facing AI disclosure
Visible "AI-generated" or "AI-assisted" indicator at the point of consumption.
Aligns with EU AI Act Art. 50 transparency obligations and CCPA notices.

### G7 — Eval suite
Minimum: a regression dataset with ≥30 cases per intent, scored on accuracy,
refusal correctness, hallucination rate, and latency. Run in CI on every
prompt or model change. Stored under the surface package as `evals/`.

### G8 — Bias eval
Stratified evaluation across protected-attribute proxies relevant to the
surface. For Nzila: age, sex, disability status (where surface processes
member data); preferred-language cohort; jurisdiction. Material disparity
(≥10 percentage points across cohorts on key metrics) is a release blocker.

### G9 — Adversarial test
Standard prompt-injection corpus + jailbreak attempts + data-exfiltration
probes. For Tier-1 also: indirect injection via retrieved documents.

### G10 — Human-in-the-loop documented
Where the surface contributes to a decision affecting a person, document
who reviews, when, with what authority to override, and how their decision
is recorded.

### G11 — Conformity dossier (Tier 1 only)
Mirrors the EU AI Act Annex IV technical-documentation outline:
- General description and intended purpose
- System architecture
- Data sets used (training, validation, testing)
- Risk management process
- Pre-determined changes and continuous learning approach
- Human oversight measures
- Performance metrics
- Cybersecurity measures

### G12 — Cost / token budget
Per-surface daily / monthly budget enforced via `packages/platform-cost-control`.
Breach triggers alert + circuit breaker.

### G13 — Observability
Standard fields: `request_id`, `org_id`, `surface`, `model`, `model_version`,
`prompt_hash`, `input_tokens`, `output_tokens`, `latency_ms`, `cost`,
`refusal`, `flagged`. No raw Restricted content in logs.

### G14 — Incident playbook addendum
Surface-specific addendum to the security incident plan documenting:
detection signals (drift, failure rate, user reports), containment actions
(disable surface, downgrade model, enable strict mode), and rollback.

### G15 — Kill switch
Feature flag or env var that disables the surface in <5 minutes without a
deploy. Tested before launch.

### G16 — Post-launch monitoring
Defined SLOs (latency, error, refusal, cost) with alerting; first 30 days
in heightened-observation mode; weekly review for the first quarter.

## CI integration (target)

A `governance/ai/lifecycle-check.ts` script (TODO) walks the inventory and
fails CI when:
- A row references missing PIA, eval, or addendum files
- A Tier-1 row lacks AIGC approval
- A live surface is missing required gates
