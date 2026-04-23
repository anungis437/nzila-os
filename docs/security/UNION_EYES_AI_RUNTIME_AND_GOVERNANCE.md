# UNION EYES AI RUNTIME AND GOVERNANCE

Date: 2026-04-23
Scope: AI runtime connectivity, controls, and production safety posture

## Runtime Connectivity

Primary implementation path:
- `apps/union-eyes/lib/ai/ai-client.ts`
- Uses `@nzila/ai-sdk` via centralized `createAiClient` wrapper.

Voice transcription path:
- `apps/union-eyes/app/api/voice/upload/route.ts`
- Calls Azure OpenAI Whisper endpoint using dedicated whisper env vars with fallback to main Azure OpenAI vars.

Additional speech path:
- `apps/union-eyes/lib/azure-speech.ts` (Azure Speech SDK)

## Where AI Is Used

Representative AI endpoints/surfaces include:
- `/api/ai/summarize`
- `/api/ai/search`
- `/api/ai/semantic-search`
- Cognition endpoints under `/api/cognition/*`
- Voice upload/transcribe flows under `/api/voice/*`

## Governance Controls Present

Implemented controls:
- Advisory-only output contract in AI responses (human review required patterns used in route outputs).
- Feature-flag service includes AI flags (`ai_*`) in `lib/services/feature-flags.ts`.
- AI guard helper in `lib/ai/ai-feature-guard.ts` supports:
  - feature gating,
  - audit refs,
  - confidence/explanation envelope,
  - fallback response shape.

## Control Gaps

Status: PASS WITH CONDITIONS

Gaps observed:
- AI guard helper exists but is not demonstrably enforced on every AI endpoint.
- No single documented global AI kill-switch procedure verified end-to-end in this pass.
- Confidence/rationale metadata is present in key paths but not uniformly guaranteed across all AI surfaces.

## Failure Behavior

Current expected behavior:
- Missing AI provider configuration should return controlled error responses on affected endpoints.
- AI should remain advisory and not auto-execute binding decisions.

Required hardening for production:

1. Mandatory AI route wrapper:
- Apply `guardAiFeature()` on every user-facing AI route.

2. Global kill switch:
- Introduce and document a single org/global flag path that disables all AI endpoints without redeploy.

3. Uniform envelope:
- Enforce a common response contract for all AI outputs:
  - confidence,
  - explanation/rationale,
  - audit reference,
  - review-required marker,
  - provider/model metadata.

4. Observability:
- Centralize AI invocation logs with request ID and org ID; alert on provider failure rate thresholds.

## User-Facing Claim Boundaries

Approved claims:
- AI is advisory only.
- AI outputs require human review.
- AI features are feature-flag controlled.

Disallowed claims unless specifically evidenced in environment proof:
- universal reasoning chain for every AI output,
- universal no-training statement without provider contract evidence attached,
- universal regional guarantee without deployment proof.

## Verdict

- AI connected: Yes (code-level integration present; live proof partial by feature).
- AI production-safe: Not fully.
- Required before production: mandatory route guard coverage + global kill switch runbook + per-feature live proof.
