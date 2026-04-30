# Bias Mitigation Playbook

**Owner:** AI Lead · **Reviewer:** AIGC · **Last update:** 2026-04-28
**Source bundle:** Info-Tech *Mitigate Machine Bias* (4 phases) +
Mitchell et al. *Model Cards* + Gebru et al. *Datasheets for Datasets*.

## 1. Scope

This playbook is the **operational** companion to:

- [`governance/ai/risk-classification.md`](risk-classification.md) (which surfaces are Tier-1 / require fairness panels)
- [`governance/ai/templates/model-card-template.md`](templates/model-card-template.md)
- [`governance/ai/templates/datasheet-for-datasets.md`](templates/datasheet-for-datasets.md)
- [`tooling/ai-evals/datasets/*/bias-panel.json`](../../tooling/ai-evals/datasets/) (per-surface bias panels)

It applies to every AI/ML surface in [`inventory.json`](inventory.json).

## 2. Bias taxonomy (working set)

We use a Phase-aligned taxonomy adapted from the source bundle:

| Phase | Class of bias | Example in Nzila context |
|-------|--------------|--------------------------|
| 1 — Understand | Historical bias | Past grievance outcomes embedded in training corpus |
| 1 — Understand | Representation bias | Under-representation of a member language / local |
| 2 — Data | Sampling bias | Console RAG built only on Anglophone corpora |
| 2 — Data | Measurement bias | Severity coded inconsistently across locals |
| 2 — Data | Aggregation bias | One model averaged across heterogeneous member groups |
| 3 — Model | Algorithmic bias | Threshold tuned on majority cohort |
| 3 — Model | Evaluation bias | Eval set non-representative of deployment cohort |
| 4 — Deployment | Deployment bias | Surface used for purposes outside intended scope |
| 4 — Deployment | Feedback-loop bias | Auto-labeling reinforces past decisions |

## 3. Required artifacts per surface

| Tier | Datasheet (training/eval data) | Model card | Bias panel | Adversarial set | Periodic re-eval |
|:----:|:------------------------------:|:----------:|:----------:|:---------------:|:----------------:|
| 1    | required                       | required   | required   | required        | quarterly        |
| 2    | required if surface uses bespoke data | required | required | recommended | semi-annual      |
| 3    | recommended                    | recommended| —          | —               | annual           |

Validation is enforced by [`tooling/contract-tests/ai-inventory-integrity.test.ts`](../../tooling/contract-tests/ai-inventory-integrity.test.ts) (eval dataset existence) and the AIGC review at [`governance/ai/lifecycle-gates.md`](lifecycle-gates.md) gate G6 (fairness review).

## 4. Operating procedure

### Phase 1 — Understand
1. Surface owner identifies relevant protected/sensitive attributes for the deployment context (jurisdiction-aware: Quebec Charter, federal CHRA grounds).
2. Owner enumerates plausible bias classes from §2 and records them in the surface's model card §8.

### Phase 2 — Data
1. Owner produces or updates a [datasheet](templates/datasheet-for-datasets.md) for every dataset used for training, fine-tuning, or evaluation.
2. Where possible, compute group statistics on features that proxy protected attributes; record in the datasheet §2.
3. If the dataset is **synthetic**, attach the [synthetic data decision record](synthetic-data-policy.md) and document distribution choices.

### Phase 3 — Model
1. Author the [model card](templates/model-card-template.md) before launch.
2. Run the bias panel from `tooling/ai-evals/datasets/<surface>/bias-panel.json` and report parity metrics in model card §7.
3. Run the adversarial set from `tooling/ai-evals/datasets/<surface>/adversarial-prompts.json`; record refusal/safe-completion rates.
4. If parity gap exceeds the surface's accepted threshold (default ≤ 5pp on primary metric across panel cohorts), block launch — escalate to AIGC.

### Phase 4 — Deployment
1. Kill switch verified per lifecycle gate G15.
2. User-facing AI disclosure published per gate G14 (Tier ≤ 2 with UI).
3. Telemetry includes group-blind aggregates suitable for ongoing fairness monitoring (no Restricted-tier raw protected attributes in logs).
4. Quarterly re-eval (Tier 1) compares panel metrics to baseline; >2pp drift → AIGC review.

## 5. Incident response

A fairness incident is any:

- Bias panel parity gap > threshold (Phase 3 acceptance) detected in production
- User report of disparate treatment that holds up to investigation
- Drift signal (Phase 4) sustained for ≥ 2 consecutive measurements

Response follows [`governance/ai/AI_SAFETY_PROTOCOLS.md`](AI_SAFETY_PROTOCOLS.md) incident workflow with the AIGC notified within 1 business day for Tier-1 surfaces.

## 6. References

- Source bundle: `infotech/Reporting/_extracted/Mitigate-Machine-Bias/`
- Suresh & Guttag (2021). *A Framework for Understanding Sources of Harm throughout the Machine Learning Life Cycle.*
- Mitchell et al. (2019). *Model Cards for Model Reporting.*
- Gebru et al. (2021). *Datasheets for Datasets.*
- NIST AI RMF 1.0 (2023) — MAP / MEASURE / MANAGE for fairness
- EU AI Act Art. 10 (Data and data governance) and Art. 15 (Accuracy, robustness, cybersecurity)
- Quebec Charter of Human Rights and Freedoms; Canadian Human Rights Act
