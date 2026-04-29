# Model Card — `<surface-id>`

> Adapted from Mitchell et al., *Model Cards for Model Reporting* (FAT* 2019)
> for use within Nzila. One model card per AI/ML surface listed in
> [`governance/ai/inventory.json`](../inventory.json). Required for any
> Tier-1 surface before AIGC approval.

| Field | Value |
|-------|-------|
| **Surface id** | `<id from inventory.json>` |
| **Version** | `<semver / date>` |
| **Owner** | |
| **Reviewer (AIGC)** | |
| **Last updated** | YYYY-MM-DD |

## 1. Model details

- **Person / org developing the model:** Nzila + (vendor, if any)
- **Model date:**
- **Model version / hash:**
- **Model type:** (e.g., LLM API call to Azure OpenAI `gpt-4.1-mini`, or local logistic, or RAG pipeline)
- **Training algorithms / parameters / fairness constraints:** (vendor-managed for hosted; document any fine-tunes / adapters / system prompts)
- **Paper / resources for more information:**
- **Citation details / license:**
- **Where to send questions / comments:**

## 2. Intended use

- **Primary intended uses:**
- **Primary intended users:**
- **Out-of-scope use cases:** (must include any prohibited use under [`governance/ai/ai-policy.md`](../ai-policy.md))

## 3. Factors

- **Relevant factors** (groups, instrumentation, environments) considered in evaluation:
- **Evaluation factors** disaggregated:

## 4. Metrics

- **Model performance measures:** (accuracy, F1, BLEU, latency, refusal rate, eval pass rate from `tooling/ai-evals/`)
- **Decision thresholds:**
- **Variation approaches:** (CIs, bootstrapping)

## 5. Evaluation data

- **Datasets:** (paths under `tooling/ai-evals/datasets/<surface>/`)
- **Motivation:**
- **Pre-processing:**

## 6. Training data

- (For hosted models: vendor-managed — document Azure OpenAI `gpt-4.1-mini` provenance per Microsoft DPA. For local models or fine-tunes: link the corresponding [`datasheet-for-datasets.md`](datasheet-for-datasets.md))

## 7. Quantitative analyses

- **Unitary results:**
- **Intersectional results:** (link bias panel from `tooling/ai-evals/datasets/<surface>/bias-panel.json`)

## 8. Ethical considerations

- **Sensitive data:**
- **Human life:** (does the model affect human life? if yes — Tier 1)
- **Mitigations:**
- **Risks and harms:**
- **Use cases of concern:**

## 9. Caveats and recommendations

- Known limitations
- Recommendations for use
- Future improvements

## References

- Mitchell, M., Wu, S., Zaldivar, A., et al. (2019). *Model Cards for Model Reporting.* FAT* 2019. <https://arxiv.org/abs/1810.03993>
- Source PDF (Info-Tech bundle): `infotech/Reporting/_extracted/Mitigate-Machine-Bias/09-Model-Cards-For-Model-Reporting.pdf`
- Nzila inventory: [`governance/ai/inventory.json`](../inventory.json)
- Risk classification: [`governance/ai/risk-classification.md`](../risk-classification.md)
