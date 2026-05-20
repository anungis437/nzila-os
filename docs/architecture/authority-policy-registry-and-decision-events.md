# Authority Policy Registry & Decision Events

> Status: implemented (commit on `fix/ue-demo-db-restore-script`)
>
> Owners: Platform / Control Plane

## Why this exists

Prior to this change, the Control Plane workflow authorizer:

- Ran with an empty `PolicyDefinition[]`, falling through to "allow" for any
  caller that passed an entitlement check.
- Hardcoded a single `domain: 'commerce'` when constructing the contextual
  policy context.
- Recorded every authority decision into an in-memory `DecisionRecord[]` that
  was lost on process restart and unobservable across replicas.

That made the platform indistinguishable from a permit-by-default system at
runtime, and made post-hoc audit of "what did we decide, why, and under
which policy?" impossible. Procurement, regulators, and partners cannot
trust a control plane whose decisions are not durable.

## What changed

1. **`apps/control-plane/server/authority/policy-registry.ts`** — a typed,
   deny-by-default workflow policy registry. Workflows MUST register a
   `WorkflowPolicy` declaring their domain, allowed actor types, allowed
   actions, allowed roles, optional approval roles, and rationale. Workflows
   that are not registered are denied with `NO_POLICY_REGISTERED`.

2. **`packages/db/src/schema/decision-events.ts`** + migration
   `migrations/platform/20260520_decision_events.sql` — a new `decision_events`
   table. Every decision (allow, deny, approval-required) is written here.
   Append-only is enforced at the database level via the shared
   `nzila_deny_mutate()` trigger function; UPDATE and DELETE will raise.

3. **`apps/control-plane/server/authority/decision.ts`** — rewritten to
   persist via `platformDb.insert(decisionEvents)`. No module-level mutable
   state remains. A deterministic `request_hash` (SHA-256 over a canonical
   JSON projection of the decision subject + redacted evaluated context) is
   computed for every event so duplicate decisions are recognizable and
   replay is deterministic.

4. **`apps/control-plane/server/authority/workflow-authorizer.ts`** — refactored
   to evaluate the registered policy, honor its decision, and persist the
   outcome. Persistence failures on the allow path are treated as a denial
   (`DECISION_PERSISTENCE_FAILED`).

5. **HTTP API** at `app/api/control-plane/authority/decisions/route.ts` —
   the POST body now requires `domain`, `actorRole`, `reasonCode`,
   `policyId`, `policyVersion`; GET handlers `await` the (now async)
   query functions.

## Data model

```text
decision_events
├── id                  uuid PK
├── org_id              uuid → orgs.id
├── domain              text   (e.g., 'commerce', 'governance', 'union_eyes')
├── workflow_id         text?
├── case_id             text?
├── actor_user_id       text?
├── actor_role          text   (role under which the decision was evaluated)
├── action              text   (e.g., 'workflow.trigger', 'governance.approve')
├── resource_type       text
├── resource_id         text?
├── decision            text   CHECK IN ('allowed','denied','approval_required')
├── reason_code         text   stable UPPER_SNAKE machine code
├── explanation         text?
├── policy_id           text
├── policy_version      text
├── evaluated_context   jsonb  redacted (no passwords/tokens/PII keys)
├── request_hash        text   sha256 over canonical subject
├── correlation_id      text?
├── trace_id            text?
├── event_type          text   (DecisionEventType enum value)
└── created_at          timestamptz default now()
```

Indexes: `(org_id, created_at)`, `(domain, created_at)`,
`(policy_id, policy_version)`, `workflow_id`, `case_id`, `actor_user_id`,
`(resource_type, resource_id)`, `correlation_id`, `created_at`.

## Authorization pipeline

```text
authorizeWorkflowTrigger(req)
   │
   ├── 1. evaluateWorkflowPolicy(req.workflowId, ctx)
   │       └── no policy registered? → deny NO_POLICY_REGISTERED
   │           wrong actor type?     → deny ACTOR_TYPE_NOT_PERMITTED
   │           action not declared?  → deny ACTION_NOT_PERMITTED
   │           role not permitted?   → deny ROLE_NOT_PERMITTED
   │
   ├── 2. resolveEntitlements({ orgId, feature })
   │       └── not granted? → deny ORG_NOT_ENTITLED
   │       └── threw?       → deny ENTITLEMENT_RESOLUTION_ERROR
   │
   ├── 3. honor policyDecision
   │       └── approval_required → persist + return requiresApproval
   │       └── denied            → persist + return denial
   │
   └── 4. allowed
           ├── recordDecisionEvent → throws? deny DECISION_PERSISTENCE_FAILED
           ├── recordAuditEvent (best-effort mirror)
           └── return WorkflowAuthorization { decisionId, ... }
```

## Reason codes (stable, machine-readable)

| Code                              | Meaning                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `NO_POLICY_REGISTERED`            | The workflowId has no registered policy.                      |
| `ACTOR_TYPE_NOT_PERMITTED`        | Actor type is not in the policy's `allowedActorTypes`.        |
| `ACTION_NOT_PERMITTED`            | The action verb is not declared in the policy.                |
| `ROLE_NOT_PERMITTED`              | Actor role is neither allowed nor an approval role.           |
| `APPROVAL_REQUIRED_BY_ROLE`       | Role may invoke but requires approval.                        |
| `POLICY_PERMITTED`                | All gates passed and a custom evaluator (if any) approved.    |
| `ORG_NOT_ENTITLED`                | Entitlement service reported the org is not entitled.         |
| `ENTITLEMENT_RESOLUTION_ERROR`    | Entitlement service threw; denied as safe default.            |
| `DECISION_PERSISTENCE_FAILED`     | Could not durably record the allow decision; denied.          |

Policies may emit their own UPPER_SNAKE reason codes via the optional
`evaluate(ctx)` hook.

## Redaction

`evaluated_context` is recursively scrubbed before persist. Keys redacted to
`'[REDACTED]'`: `password`, `token`, `apiKey`, `api_key`, `secret`,
`authorization`, `authToken`, `auth_token`, `sessionToken`, `session_token`,
`cookie`, `creditCard`, `credit_card`, `cardNumber`, `card_number`, `cvv`,
`ssn`, `tin`. Add to `REDACTED_KEYS` in `decision.ts` as new sensitive fields
are introduced.

## Append-only guarantees

The `decision_events` table installs two triggers via the shared
`nzila_deny_mutate()` function (see
`migrations/platform/hash-chain-immutability-triggers.sql`):

```sql
CREATE TRIGGER trg_decision_events_no_update BEFORE UPDATE ON decision_events ...
CREATE TRIGGER trg_decision_events_no_delete BEFORE DELETE ON decision_events ...
```

Any UPDATE or DELETE — even by a database superuser — raises
`Mutation denied: ... is structurally forbidden`. The only way to remove
rows is to drop the triggers explicitly, which leaves an audit footprint.

## Query API

The `decision.ts` module exposes:

- `getDecisionsByCorrelationId(correlationId)`
- `getDecisionsByWorkflowId(workflowId)`
- `getDecisionsForOrg(orgId, limit=50)`
- `getDecisionsByCaseId(caseId)`
- `getDecisionsByActor(orgId, actorUserId, limit=100)`
- `getDecisionsByPolicy(policyId, policyVersion?, limit=100)`
- `getDecisionsByDateRange(orgId, from, to, limit=500)`

All are indexed.

## Registering a new workflow policy

```ts
import { registerWorkflowPolicy } from '@/server/authority'

registerWorkflowPolicy({
  id: 'union_eyes.case.escalate',
  version: '1.0.0',
  domain: 'union_eyes',
  workflowIds: ['union_eyes.case.escalate'],
  allowedActions: ['workflow.trigger'],
  allowedActorTypes: ['user'],
  allowedRoles: ['case_officer', 'regional_lead'],
  approvalRequiredRoles: ['analyst'],
  approverRoles: ['regional_lead'],
  rationale: 'Case escalation must be reviewed by the regional lead.',
  evaluate(ctx) {
    if ((ctx.payload as { caseSeverity?: string }).caseSeverity === 'critical'
        && ctx.actorRole !== 'regional_lead') {
      return {
        decision: 'approval_required',
        reasonCode: 'CRITICAL_CASE_REQUIRES_REGIONAL_LEAD',
        explanation: 'Critical-severity case escalation requires regional-lead approval.',
        approverRoles: ['regional_lead'],
      }
    }
    return undefined
  },
})
```

The registry rejects duplicates, conflicting bindings for the same
workflowId, and unsupported domains at registration time — failures are
loud, never silent.

## Tests

- `apps/control-plane/server/authority/policy-registry.test.ts`
- `apps/control-plane/server/authority/decision.test.ts`
- `apps/control-plane/server/authority/workflow-authorizer.test.ts`

All three suites cover the deny-by-default paths, the persistence-failure
paths, redaction, deterministic hashing, and the happy path.

## Operational notes

- The migration `20260520_decision_events.sql` depends on
  `nzila_deny_mutate()` from
  `migrations/platform/hash-chain-immutability-triggers.sql` — apply that
  first if the staging/production DBs do not already have it.
- `recordDecisionEvent` writes via `platformDb` (no org partitioning); the
  `org_id` column is the multi-tenant boundary and every read path filters
  by it.
- Policy registration happens at module import time. Workflows that fail to
  register a policy will be denied at runtime; this is intentional and the
  failure mode under spec.
