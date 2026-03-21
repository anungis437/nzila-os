# Runbook: Platform Governed AI Failure

**Scope:** Failures in the AI governance pipeline (`platform-governed-ai`, `platform-reasoning-engine`, `platform-decision-graph`)  
**Severity:** P2 (single AI operation) / P1 (governance bypass or audit gap)  
**On-call:** Platform Engineering + AI Team

## Detection

AI governance failures surface through:

1. **Governance pre-check rejection** — policy evaluation blocks AI invocation
2. **Evidence grounding failure** — AI output cannot be linked to evidence chain
3. **Audit persistence failure** — AI run not recorded (compliance gap)
4. **Reasoning chain errors** — confidence scoring returns invalid results
5. **AI SDK errors** — `@nzila/ai-sdk` or `@nzila/ml-sdk` report upstream failures

## Triage

### Step 1: Identify failure stage

The governed AI lifecycle has four stages:

| Stage | Package | Failure symptom |
|-------|---------|-----------------|
| Policy pre-check | `platform-governed-ai` | AI request rejected before model invocation |
| Model invocation | `ai-sdk` / `ml-sdk` | Timeout, rate limit, model error |
| Evidence grounding | `platform-governed-ai` | Evidence chain incomplete or hash mismatch |
| Audit persistence | `platform-governed-ai` | Audit record missing or write failure |

### Step 2: Check policy state

If pre-check is rejecting requests:
- Verify org policy configuration
- Check if a new regulatory constraint was added
- Review policy engine logs in `platform-policy-engine`

### Step 3: Check model availability

If model invocation fails:
- Verify API key / managed identity credentials
- Check model provider status (OpenAI, Azure AI)
- Review rate limit headers in response

## Response

### Policy rejection (legitimate)

1. Confirm the policy is intentional (not a misconfiguration)
2. Inform the requesting team of the policy constraint
3. If override needed, follow governance exception process (`governance/exceptions/`)

### Model provider outage

1. Check provider status page
2. If prolonged, activate fallback model (if configured)
3. Queue requests for retry once provider recovers

### Audit persistence failure

**This is a P1** — AI operations without audit trails violate governance invariants.

1. Immediately halt affected AI operations
2. Verify audit storage (Azure Blob) connectivity
3. Replay failed audit writes from the event queue
4. Confirm no gap in audit trail before re-enabling

### Reasoning chain errors

1. Check input data quality — garbage-in produces invalid confidence scores
2. Verify `platform-ontology` types match expected schema
3. Review reasoning chain steps for unexpected `null` or `undefined` values

## Verification

- AI operations complete through all four governance stages
- Audit records present for every AI invocation
- Evidence chains are intact and hash-verifiable

## References

- Governed AI: `packages/platform-governed-ai/`
- Reasoning Engine: `packages/platform-reasoning-engine/`
- Decision Graph: `packages/platform-decision-graph/`
- AI SDK: `packages/ai-sdk/`
- ML SDK: `packages/ml-sdk/`
- AI integration contract tests: `tooling/contract-tests/ai-integration.test.ts`
