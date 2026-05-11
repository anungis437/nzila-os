# Zonga — Guard Architecture Guide

## Overview

Guards are pure, synchronous validation functions that enforce business
invariants before mutations execute. They live in `lib/guards/` and are
imported directly by handlers and action files.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Command Bus                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Pre-Execution Guard Pipeline                           │ │
│  │  registerPreExecutionGuard({ name, appliesTo, check })  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Handler (e.g. execute-payout.handler.ts)               │ │
│  │  → calls domain guards directly (gatePayout, G1, etc.)  │ │
│  │  → calls compensation on failure                        │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Guard Modules

### `guards/economic-guards.ts`

Pure functions for E1–E6. All accept an `EconomicGuardInput` object:

```typescript
interface EconomicGuardInput {
  totalRevenue: number
  ledgerEntryCount: number
  totalPaidOut: number
  requestedPayout: number
  totalDebits: number
  totalCredits: number
  transactionStatus: string
  settlementExpected: number
  settlementActual: number
}
```

`runEconomicGuards(input)` runs all 6 sequentially, short-circuits on first failure.

### `guards/rights-guards.ts`

Individual functions with focused signatures:

- `guardSplitsSum100(splits: readonly { sharePercent: number }[])`
- `guardNoPayoutOnDisputedRelease(hasActiveDispute: boolean, releaseId: string)`
- `guardSplitsHaveValidCreators(splits: readonly { creatorId: string; creatorName: string }[])`
- `guardDisputeResolutionUnfreezes(remainingActiveDisputes: number, willUnfreeze: boolean)`
- `guardSyncLicenseHasRightsHolder(assetId: string, hasRightsHolder: boolean)`

### `guards/ticketing-guards.ts`

Functions for ticketing concurrency:

- `guardNoOversell(sold, available)` — T1
- `guardAtomicReservation(insertedCount)` — T2
- `guardRefundEligibility(purchasedAt, status, cutoffHours)` — T3
- `guardNoDuplicateScan(ticketStatus)` — T4
- `guardEventNotCancelled(eventStatus)` — T5
- `guardTransferOwnership(currentOwnerId, requesterId, ticketStatus)` — T6

### `guards/governance-guards.ts`

Security and governance validation:

- `guardAdminActionReason(reason, minLength)` — G1
- `guardRoleAuthorization(userRole, requiredRoles)` — G2
- `guardRateLimit(actionCount, maxActions, windowMs, windowStart)` — G3
- `guardAuditCompleteness(auditFields)` — G4
- `guardEnvironmentRestriction(env, allowedEnvs)` — G5

### `guards/compensation.ts`

Failure recovery utilities (async — write to DB):

- `compensateFailedPayout(db, payoutId, error, correlationId)`
- `compensateFailedTicketPurchase(db, ticketId, error)`
- `compensateReleaseTransition(db, releaseId, previousStatus, error)`

## Integration Pattern

Guards are called **inline** in handlers and actions — not via middleware.
This keeps the enforcement visible and auditable:

```typescript
// In execute-payout.handler.ts
const gateResult = await gatePayout({ ... })
if (!gateResult.allowed) {
  return { success: false, code: 'PAYOUT_GATED', reason: gateResult.reason }
}
```

## Testing

Each guard module has a corresponding test file in `__tests__/`:

- `economic-guards.test.ts` — 18 tests
- `rights-guards.test.ts` — 12 tests
- `ticketing-guards.test.ts` — 20 tests
- `governance-guards.test.ts` — 14 tests
