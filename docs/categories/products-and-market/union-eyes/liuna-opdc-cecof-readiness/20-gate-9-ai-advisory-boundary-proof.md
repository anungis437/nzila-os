# 20 - Gate 9 AI Advisory Boundary Proof

## Gate Decision

`LIUNA_GATE_9_AI_COPILOT_BOUNDARY = ADVISORY_GOVERNED_PROVEN`

The steward copilot is now covered by a LIUNA-relevant static contract test for the boundary that matters in an executive recording:

- steward role gate;
- feature gate;
- advanced-AI entitlement gate;
- AI safety invocation;
- internal data class;
- organization-scoped trace;
- audit reference;
- AI-generated response metadata;
- `reviewRequired: true`;
- persisted session outcome starts as `pending`;
- human approval is recorded only after accept/edit outcomes.

## Validation

Source and test:

- `apps/union-eyes/app/api/ai/copilot/query/route.ts`
- `apps/union-eyes/lib/ai/steward-copilot.ts`
- `tooling/contract-tests/union-eyes-ai-copilot-boundary.test.ts`

## Claim Boundary

This gate supports a truthful recording claim that Union Eyes uses AI as audited, human-reviewed steward support.

It does not prove privileged legal advice, autonomous decision-making, or safe ingestion of every restricted matter document into AI prompts.

## Remaining Sensitive-Pilot Gap

AI can be shown as advisory continuity support in a synthetic scenario. A sensitive legal-matter pilot still needs explicit prompt/source redaction and restricted-document AI-ingestion tests before any privileged briefing claim.
