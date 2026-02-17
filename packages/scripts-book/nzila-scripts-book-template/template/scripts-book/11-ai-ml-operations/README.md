# Chapter 11 — AI/ML Operations (Optional)

This chapter covers AI and machine-learning operational patterns for
**{{PRODUCT_NAME}}**. It is an optional module — skip it if the application
does not include AI/ML features.

## Overview

AI/ML capabilities are integrated as services behind API routes. Models are
consumed via provider SDKs rather than trained in-house, keeping the
operational footprint minimal.

## Provider integration

| Capability         | Provider       | SDK / API                |
| ------------------ | -------------- | ------------------------ |
| Text generation    | OpenAI / Azure | `openai` npm package     |
| Embeddings         | OpenAI / Azure | `openai` npm package     |
| Document parsing   | Custom         | Internal service         |

## Configuration

| Variable              | Description                    |
| --------------------- | ------------------------------ |
| `OPENAI_API_KEY`      | API key for the LLM provider   |
| `AI_MODEL`            | Model identifier (e.g., gpt-4) |
| `AI_MAX_TOKENS`       | Maximum tokens per request     |
| `AI_TEMPERATURE`      | Sampling temperature           |

## Prompt management

- Prompt templates are stored in `prompts/` as plain-text files.
- Each prompt is versioned alongside the application code.
- Changes to prompts go through the same PR review process as code changes.

## Rate limiting and cost control

- AI endpoints enforce per-tenant rate limits independent of general API
  rate limits.
- A daily spend cap is configured per tenant. When exceeded, AI features
  return `429 Too Many Requests`.

## Evaluation and monitoring

- Response quality is tracked via user feedback signals (thumbs up/down).
- Latency and token usage are recorded as OpenTelemetry metrics.
- A weekly report summarizes cost, usage, and quality trends.

## Data privacy

- User inputs sent to external AI providers are logged for debugging but
  scrubbed of PII before transmission.
- Tenant data is never used to fine-tune shared models.
- The AI privacy policy is documented in the application's terms of service.
