# Nzila Foundational AI Principles

**Doc ID:** AI-PRIN-2026-001
**Version:** 1.0
**Owner:** AI Governance Committee
**Status:** ACTIVE
**Next review:** 2027-Q2

These principles are binding for every AI capability Nzila builds, deploys,
or procures. They derive from NIST AI RMF "trustworthy AI" characteristics,
OECD AI Principles, EU AI Act fundamental rights protections, and PIPEDA OPC
guidance, and are tailored to Nzila's operational context (union member
services, fintech-adjacent surfaces, cross-border AI inference).

## P1. Lawful and aligned with human values

AI MUST operate within applicable law and within Nzila's mission to serve
members, partners, and operators. Any use that would conflict with
fundamental rights or that falls into an EU AI Act prohibited category is
not permitted.

## P2. Human oversight by default

For any AI output that materially affects a person, a human in the loop is
mandatory before action. AI outputs are advisory unless explicitly approved
otherwise via DPIA + AI Governance Committee.

## P3. Privacy by design and minimization

Personal data sent to a model is minimized to what is necessary for the
purpose. Special-category data (health, biometrics) requires explicit
PIA approval and a documented lawful basis. See [`../privacy/ai-pia/`](../privacy/ai-pia/).

## P4. Fairness and non-discrimination

Datasets, prompts, and evaluations are reviewed for foreseeable bias on
protected attributes (race, sex, age, disability, religion, etc.) and
proxy variables. Material bias is mitigated or the use case is rejected.

## P5. Transparency and explainability

Users interacting with an AI system are informed it is AI. Decisions
materially affecting a person come with an intelligible explanation and a
**reasoning context envelope** (model, prompt template version, retrieved
evidence ids, confidence) is recorded for audit (PIPEDA OPC Proposal #9).

## P6. Validity and reliability

Every production AI surface has documented evals (intent accuracy, hallucination
rate, refusal correctness, regression set) run on every model/version change
and on a recurring cadence.

## P7. Safety, security, and adversarial resilience

AI surfaces are tested against prompt injection, jailbreak, data exfiltration,
and model-supply-chain attacks. Restricted data is never sent to models that
lack a zero-retention contract.

## P8. Accountability and traceability

Every AI surface has a named Surface Owner. Every AI invocation is correlated
to a request id linking input, retrieval context, model call, output, and
downstream action.

## P9. Sustainability and proportionality

Model choice is proportionate to the task. Smaller / cheaper / on-device
models are preferred when they meet quality bars. AI usage cost and energy
proxies are tracked (`packages/platform-cost-control`).

## P10. Adaptive governance

Principles, policies, risk registers, and assurance programs are reviewed
on a defined cadence AND on any material change (model, regulation,
incident). Stale governance is treated as a defect.

---

## How these are enforced

| Principle | Enforcement mechanism |
|-----------|----------------------|
| P1 | [risk-classification.md](risk-classification.md) blocks prohibited classes |
| P2 | [ai-policy.md](ai-policy.md) §5; PR review checklist |
| P3 | [`../privacy/ai-pia/`](../privacy/ai-pia/) per surface; data-classification standard |
| P4 | [assurance-program.md](assurance-program.md) bias evals |
| P5 | Reasoning context envelope contract test |
| P6 | [assurance-program.md](assurance-program.md) eval gates |
| P7 | Adversarial evals + supply-chain policy |
| P8 | [inventory.md](inventory.md) Surface Owner; correlation id in observability |
| P9 | `packages/platform-cost-control` budgets and reports |
| P10 | [`README.md`](README.md) review cadence |
