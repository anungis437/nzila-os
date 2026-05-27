# Proof Scenario: AI-Controlled Request

## Scenario Summary

Proves that an AI-assisted request cannot bypass `@nzila/ai-control`. The full
flow demonstrates: policy registry evaluation → budget check → model invocation →
output classification → spend recording → log creation — all correlated by
tenant and actor identity with trace context.

## Entrypoint

```bash
pnpm exec tsx scripts/proof/run-proof.ts ai-controlled-request
```

Or via the test runner:

```bash
npx vitest run tests/e2e/platform/ai-controlled-request.test.ts
```

## Request Sample

```json
{
  "model": "gpt-4",
  "tenantId": "tenant_ai_demo",
  "actorId": "user_analyst_001",
  "prompt": "Summarize the quarterly financial report for Q1 2026.",
  "systemPrompt": "You are a financial analyst assistant.",
  "temperature": 0.3,
  "maxTokens": 500,
  "metadata": {
    "dataClassification": "internal",
    "department": "finance"
  }
}
```

## Expected Control Path

1. **Policy check** — `AIPolicyRegistry` evaluates: model allowed, data classification permitted
2. **Budget check** — tenant spend within monthly cap
3. **Provider invoke** — model processes prompt (test uses mock provider)
4. **Output classification** — result classified as `safe`
5. **Spend recording** — cost charged to tenant period
6. **Log creation** — `AILogEntry` with prompt hash, response hash, tokens, cost

## Expected Artifact Files

```
proof-artifacts/ai-controlled-request/
  summary.json          — normalized proof metadata
  request.json          — AI request envelope
  response.json         — AI response with classification
  ai-control.json       — policy decision, budget status, classification
  trace.json            — trace context
```

## How to Run Locally

```bash
pnpm exec tsx scripts/proof/run-proof.ts ai-controlled-request
```

## How to Validate in CI

The `proof-publish` CI job runs all scenarios. AI control artifacts are uploaded
and verified by `pnpm exec tsx scripts/proof/verify-artifacts.ts`.

## What "Pass" Means

- AI response is returned with content
- Policy decision is `allowed: true`
- Budget status is `ok` or `warning` (not `blocked`)
- Output classification is `safe`
- Log entry contains prompt hash and response hash
- Spend is recorded for the correct tenant and period
- All artifact files are written

## What Regression Would Look Like

- `AIControlError` with code `POLICY_DENIED` → policy rules changed unexpectedly
- `AIControlError` with code `BUDGET_EXCEEDED` → budget config or spend tracking bug
- Output classified as `restricted` → classifier regression
- Missing log entry → log store not wired
- Missing tenant correlation → identity propagation broken
