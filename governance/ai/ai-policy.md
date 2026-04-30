# Nzila AI Policy

**Doc ID:** AI-POL-2026-001
**Version:** 1.0
**Owner:** AI Governance Committee
**Status:** ACTIVE
**Next review:** 2027-Q2
**Authority:** [governance-committee-charter.md](governance-committee-charter.md)

## 1. Purpose & scope

This policy is binding on every employee, contractor, and integrated vendor
who builds, deploys, procures, or operates AI on behalf of Nzila Ventures.

"AI" includes generative models (LLMs, image, audio), embedding models,
classical ML, decision systems, and agentic tools.

## 2. Foundational principles

This policy operationalizes [principles.md](principles.md). All ten principles
apply.

## 3. Risk classification gate

Every new or materially changed AI surface MUST be classified per
[risk-classification.md](risk-classification.md) BEFORE any production
deployment.

| Class | Required approvals | Required artifacts |
|-------|-------------------|--------------------|
| Prohibited | None — disallowed | n/a |
| High | AIGC + Legal + Privacy Lead + Security Lead | PIA, conformity assessment, monitoring plan, incident plan, registration in inventory |
| Limited | Privacy Lead + Surface Owner | PIA, transparency disclosure, eval plan |
| Minimal | Surface Owner | Inventory entry; standard SDLC |

## 4. Permitted uses

- Internal productivity (drafting, summarization, code assistance) on Internal-tier or below content
- Customer-facing assistance with explicit AI disclosure
- Operational tooling where outputs are advisory and reviewed
- Use cases approved through the gate in §3

## 5. Prohibited uses (absolute)

Nzila will NOT build or deploy AI that:

1. Falls into any EU AI Act prohibited category (subliminal manipulation, exploitation of vulnerabilities, social scoring, predictive policing, untargeted facial-recognition scraping, emotion inference at work/education, sensitive-attribute biometric categorization, real-time public biometric ID with limited exceptions)
2. Makes a final adverse decision about a person without human review (no Art. 22-equivalent solely-automated decisions affecting members)
3. Sends Restricted data (PHI, payment data, secrets) to a model without a zero-retention contract AND a HIGH-risk approval
4. Uses copyrighted material without lawful basis
5. Generates deepfakes, impersonations, or election-related content
6. Performs surveillance of employees beyond what is documented in HR policy and consented to

## 6. Data rules

- **Minimization:** only the data needed for the purpose is sent.
- **Tier-aware:** see [`../privacy/policies/data-classification-standard.md`](../privacy/policies/data-classification-standard.md). Restricted data requires explicit AIGC sign-off.
- **No production data in non-prod prompts.** Use synthetic per [synthetic-data-policy.md](synthetic-data-policy.md).
- **Retention:** model interaction logs follow the AI surface's PIA retention; never longer than 1 year unless legal-hold.
- **Cross-border:** documented in the surface's PIA; SCCs where required.

## 7. Vendor / model rules

- Approved providers list maintained by AIGC (see [inventory.md](inventory.md))
- New providers require: DPA, security review, zero-retention contract for Confidential+ data, sub-processor disclosure
- Model version changes are a material change → trigger §3 review
- Open-source models require security review of weights provenance

## 8. Build rules (engineering)

- All AI calls go through the platform cognition layer (`packages/platform-cognition-core` / `packages/ue-cognition`) — no direct provider SDK calls in app code without exception
- Reasoning context envelope MUST accompany every model call
- All AI surfaces emit standard observability (request id correlation, latency, token counts, cost, output classification)
- Prompts are versioned in source control; prompt changes go through code review
- Outputs touching action paths MUST go through validation (schema, allow-list, content filter)
- Adversarial test suite required for any High-risk surface

## 9. Operate rules

- Eval suite runs on every model/version change AND weekly
- Drift monitoring (output distribution, refusal rate, user-reported issues) reviewed monthly by AIGC
- Incident response runs the AI track (see [`../privacy/incidents/security-incident-management-plan.md`](../privacy/incidents/security-incident-management-plan.md) §5 + AI-specific addendum in [assurance-program.md](assurance-program.md))

## 10. User-facing transparency

- Every AI surface that interacts with a user must clearly disclose it is AI
- Every materially affected person must be able to: (a) get an explanation, (b) request human review, (c) object/opt-out where lawful basis is consent or legitimate interest

## 11. Exceptions

Exceptions are recorded in `governance/exceptions/` with: scope, rationale,
compensating controls, owner, expiry (max 6 months, renewable once with
re-review).

## 12. Noncompliance

Per [`../security/APPLICATION_SECURITY_POLICY.md`](../security/APPLICATION_SECURITY_POLICY.md) §8.
Material noncompliance can trigger immediate rollback by the on-call IC and
post-incident review by AIGC.

## 13. Training

All engineers and operators with AI-touching responsibilities complete
annual AI policy training. Tracking per [`../privacy/metrics/privacy-metrics.md`](../privacy/metrics/privacy-metrics.md) §11.
