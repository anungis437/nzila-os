# Zonga — Critical Operations Matrix

Every mutation in Zonga that affects money, rights, identity, or governance
passes through the **control layer** (`lib/control/`). This matrix enumerates
every critical operation, its enforcement point, and the guard that protects it.

## Command-Bus Operations (6 Handlers)

| Command | Handler | Guard(s) | Pre-Execution | Audit Event |
|---------|---------|----------|---------------|-------------|
| `register-creator` | `register-creator.handler.ts` | Command-bus pre-guards | Yes | `creator.registered` |
| `create-release` | `create-release.handler.ts` | Command-bus pre-guards | Yes | `release.created` |
| `transition-release-status` | `transition-release-status.handler.ts` | FSM (`release-state-machine`) + pre-guards | Yes | FSM audit event |
| `create-moderation-case` | `create-moderation-case.handler.ts` | Command-bus pre-guards | Yes | `moderation.case.created` |
| `resolve-moderation-case` | `resolve-moderation-case.handler.ts` | G1 (`guardAdminActionReason`) + pre-guards | Yes | `moderation.case.resolved` |
| `execute-payout` | `execute-payout.handler.ts` | `gatePayout()` + economic invariants | Yes | `payout.executed` |

## Server-Action Operations (14 Action Files)

| Action File | Critical Operations | Enforcement |
|-------------|-------------------|-------------|
| `event-actions.ts` | `purchaseTicket` | Atomic INSERT…SELECT (T1-T2), governance check on `publishEvent` |
| `rights-actions.ts` | `fileRightsDispute`, `resolveRightsDispute` | Payout freeze on dispute, unfreeze on resolution |
| `revenue-actions.ts` | `recordRevenueEvent` | Ledger backing entry (E1) |
| `moderation-actions.ts` | `assignModerationCase` | Audit trail |
| `payout-actions.ts` | `executePayoutAction` | Routes through command-bus → `execute-payout` handler |
| `commerce-actions.ts` | Org-scoped transactions | Org isolation via context |
| `streaming-actions.ts` | Revenue attribution | Org-scoped |
| `analytics-actions.ts` | Read-only | N/A |

## Pre-Execution Guard Pipeline

The command bus supports `registerPreExecutionGuard()` — any registered guard
can block a command before it reaches the handler:

```typescript
registerPreExecutionGuard({
  name: 'economic-integrity',
  appliesTo: ['execute-payout'],
  check: async (ctx) => ({ allowed: true })
})
```

## Guard Modules (22 Guards Total)

| Module | Guards | Invariants |
|--------|--------|------------|
| `guards/economic-guards.ts` | E1-E6 | Revenue/ledger, payout balance, no negative, reconciliation |
| `guards/rights-guards.ts` | R1-R5 | Splits sum 100%, no payout on dispute, valid creators |
| `guards/ticketing-guards.ts` | T1-T6 | No oversell, atomic reservation, refund eligibility |
| `guards/governance-guards.ts` | G1-G5 | Admin reasons, role auth, rate limit, audit completeness |
| `guards/compensation.ts` | 3 compensators | Failed payout, ticket, transition recovery |
