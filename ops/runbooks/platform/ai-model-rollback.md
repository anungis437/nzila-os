# AI Model Rollback Runbook

| Field   | Value                |
|---------|----------------------|
| Status  | `DRAFT`              |
| Created | 2026-04-20           |
| Owner   | _TBD_                |

## Overview

Procedures for rolling back Azure OpenAI model deployments when a new version causes regressions in quality, safety, or performance.

## When to Rollback

| Symptom | Indicator | Threshold |
|---------|-----------|-----------|
| Hallucinations | Factual errors in outputs | >5% of sampled requests |
| Degraded quality | User complaints, eval score drop | Eval score drops >10% from baseline |
| Latency regression | p95 response time increase | p95 > 2× previous baseline |
| Safety violations | Harmful or off-topic outputs | Any confirmed instance |
| Cost spike | Unexpected token usage increase | >50% above normal daily spend |

## Steps

### 1. Identify Bad Deployment

- Check Azure Monitor metrics for the affected deployment
- Confirm which model version / deployment name is causing issues
- Cross-reference with recent deployment changes in `CHANGELOG.md`

### 2. Revert Model Config

**Via Azure Portal:**
1. Navigate to the Azure OpenAI resource (e.g., `nzila-openai-eastus`)
2. Go to **Deployments** → select affected deployment
3. Edit deployment → change model version to previous known-good version
4. Save and wait for propagation (~1–2 min)

**Via Azure CLI:**
```bash
az cognitiveservices account deployment create \
  --name nzila-openai-eastus \
  --resource-group nzila-canada-staging-rg \
  --deployment-name gpt-4 \
  --model-name gpt-4.1-mini \
  --model-version <previous-version> \
  --model-format OpenAI \
  --sku-capacity 10 \
  --sku-name Standard
```

### 3. Verify Rollback

- [ ] Confirm deployment shows previous model version in Azure Portal
- [ ] Run sample prompts through the API and verify output quality
- [ ] Check latency metrics return to baseline
- [ ] Review application logs for errors

### 4. Monitor

- Watch metrics for 1 hour post-rollback
- Confirm no recurrence of symptoms
- Update incident channel with resolution status

## Related Docs

- [Incident Response Runbook](./incident-response.md)
- [SLO Policy](../../slo-policy.yml)
