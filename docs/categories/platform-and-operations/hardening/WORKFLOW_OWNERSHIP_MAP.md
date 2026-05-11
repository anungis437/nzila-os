# Zonga — Workflow Ownership Map

All 14 state machines, their ownership domains, and integration points.

## Flow-Orchestrated Workflows (12)

| Workflow | File | Domain | States | Transitions | Terminal States |
|----------|------|--------|--------|-------------|-----------------|
| Artist Onboarding | `workflows/artist-onboarding.ts` | Identity | 10 | 13 | `rejected`, `suspended` |
| Release Publish | `workflows/release-publish.ts` | Content | 12 | 15 | `published`, `archived` |
| Event Creation | `workflows/event-creation.ts` | Events | 16 | 25 | `settled`, `cancelled` |
| Payout Settlement | `workflows/payout-settlement.ts` | Finance | 12 | 19 | `reconciled`, `disputed` |
| Ticket Sale | `workflows/ticket-sale.ts` | Ticketing | 14 | 20 | `completed`, `expired`, `cancelled` |
| Rights Dispute | `workflows/rights-dispute.ts` | Rights | 11 | 18 | `resolved_*`, `dismissed` |
| Content Moderation | `workflows/moderation.ts` | Governance | 13 | 16 | `approved`, `rejected`, `appeal_rejected` |
| Track Upload Processing | `workflows/track-upload-processing.ts` | Content | 11 | 14 | `ready`, `archived` |
| Ticket Scan | `workflows/ticket-scan.ts` | Ticketing | 9 | 10 | `checked_in` |
| Refund Flow | `workflows/refund-flow.ts` | Finance | 10 | 12 | `completed`, `rejected` |
| Rights Update | `workflows/rights-update.ts` | Rights | 9 | 10 | `completed`, `rejected` |
| Payment Failure Recovery | `workflows/payment-failure-recovery.ts` | Finance | 10 | 12 | `recovered`, `written_off` |

## Commerce-State Machines (2)

| Machine | File | Domain | States | Transitions | RBAC Roles |
|---------|------|--------|--------|-------------|------------|
| Release Machine | `release-state-machine.ts` | Content | 7 | 9 | `creator`, `admin`, `moderator`, `system` |
| Payout Machine | `payout-machine.ts` | Finance | 7 | 9 | `creator`, `admin`, `finance`, `system` |

## Control-Plane Orchestrator

The `@nzila/zonga-control-plane` package registers 12 workflow IDs in
`WorkflowId` enum, corresponding to the flow-orchestrated workflows above.
The orchestrator provides:

- **Multi-step execution** with per-step retry
- **Compensation (rollback)** on failure
- **Audit events**: `WORKFLOW_STARTED`, `WORKFLOW_STEP_COMPLETED`, `WORKFLOW_COMPLETED`, `WORKFLOW_COMPENSATED`

## Domain Ownership

| Domain | Workflows | Owner |
|--------|-----------|-------|
| Identity | Artist Onboarding | Platform team |
| Content | Release Publish, Track Upload, Release Machine | Content team |
| Events | Event Creation | Events team |
| Ticketing | Ticket Sale, Ticket Scan | Ticketing team |
| Finance | Payout Settlement, Refund Flow, Payment Recovery, Payout Machine | Finance team |
| Rights | Rights Dispute, Rights Update | Rights team |
| Governance | Content Moderation | Trust & Safety |

## Shared Infrastructure

- **Types**: `workflows/types.ts` — `Transition<S>`, `TransitionResult<S>`, `InvalidTransitionError`
- **Validators**: `validateTransition()`, `attemptTransition()`, `getAvailableTransitions()`
- **Barrel export**: `workflows/index.ts` — all 12 workflows + types
