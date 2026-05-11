# Decision Infrastructure Map

NzilaOS is organized as decision infrastructure.

Every product surface is a thin interface over a shared decision core built around one irreducible primitive:

```ts
Decision = Input + Policy + Actor Authority + Outcome + Proof
```

## Shared Decision Core

The canonical decision primitive now lives in `packages/decision-core`.

It defines:

- `DecisionInput`
- `DecisionActor`
- `DecisionAuthority`
- `DecisionPolicyRef`
- `DecisionOutcome`
- `DecisionProof`
- `DecisionRecord`
- `DecisionEvaluationResult`

The registry in `packages/decision-core/src/registry.ts` is the source of truth for decision types, required authority, policy references, replay/export support, and retention class.

## Product Surfaces

### Union Eyes = labour decision interface

Primary decisions:

- grievance intake
- escalation
- member communication approval
- vote and election workflow action

Current anchor routes:

- `apps/union-eyes/app/api/cases/intake/route.ts`
- `apps/union-eyes/app/api/cases/[caseId]/escalate/route.ts`
- `apps/union-eyes/app/api/voting/sessions/[id]/vote/route.ts`

### FairCase (ABR surface) = legal and investigation decision interface

Primary decisions:

- case classification
- evidence association
- risk scoring
- precedent matching
- report approval

Current anchor routes:

- `apps/abr/app/api/abr/incidents/route.ts`
- `apps/abr/app/api/abr/incidents/[id]/actions/route.ts`
- `apps/abr/app/api/abr/incidents/[id]/transition/route.ts`

### Flow = commerce and operations decision interface

Primary decisions:

- quote approval
- vendor selection
- fulfillment exception
- pricing adjustment

Current anchor routes:

- `apps/flow/app/api/quotes/route.ts`
- `apps/flow/app/api/quotes/review/route.ts`
- `apps/flow/app/api/quotes/send/route.ts`

### Zonga = media and rights decision interface

Primary decisions:

- content publishing
- rights validation
- payout approval
- moderation action

Current anchor routes:

- `apps/zonga/app/api/rights/route.ts`
- `apps/zonga/app/api/payouts/route.ts`
- `apps/zonga/app/api/moderation/route.ts`

### Platform Admin = authority and tenant governance interface

Primary decisions:

- role assignment
- org onboarding
- policy activation
- access exception

Current anchor routes:

- `apps/platform-admin/app/api/admin/org/route.ts`

### Console = executive observability and proof review interface

Primary decisions:

- governance review
- audit verification
- policy replay
- operating risk escalation

Current anchor routes:

- `apps/console/app/api/governance/votes/route.ts`
- `apps/console/app/api/integrations/dlq/replay/route.ts`

## Platform Roles

- Control Plane governs decision integrity, policy evaluation, and authority validation.
- Orchestrator executes approved decision workflows.
- Console reviews proof, replay, and operating risk.
- Platform Admin governs tenants, role authority, and policy activation.

## Phase 1 Outcome

Phase 1 establishes a shared decision primitive and first-route adoption without breaking current app behavior.

The next phase is full Nzila Audit Record enforcement and route-by-route migration from metadata compatibility to mandatory decision issuance.