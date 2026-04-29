# Finance Operations Runbook

## Overview

This runbook covers day-to-day operational procedures for teams working with the Nzila OS Finance Core capability layer.

## Package Locations

| Package | Path |
|---|---|
| Finance Core (types, accounts) | `packages/finance-core` |
| Finance Ledger (double-entry) | `packages/finance-ledger` |
| Finance Compliance (KYC, risk) | `packages/finance-compliance` |
| Finance Governance (approvals, funds) | `packages/finance-governance` |
| Finance Analytics (cashflow, aging) | `packages/finance-analytics` |
| Finance Identity (profiles) | `packages/finance-identity` |

## Feature Flag Management

Finance features are controlled via environment variables. Defaults are conservative — risky features start OFF.

### Enable/Disable a Feature

Set the corresponding environment variable in your deployment configuration:

```bash
# Enable the core layer
FINANCE_CORE_ENABLED=true

# Enable ledger operations
FINANCE_LEDGER_ENABLED=true

# Disable payments (default off, enable when Stripe wiring is complete)
FINANCE_PAYMENTS_ENABLED=false

# Disable payouts (default off, enable after compliance review)
FINANCE_PAYOUTS_ENABLED=false

# Enable governance workflows
FINANCE_GOVERNANCE_ENABLED=true

# Disable compliance hooks (default off until KYC provider is wired)
FINANCE_COMPLIANCE_ENABLED=false

# Enable analytics
FINANCE_ANALYTICS_ENABLED=true

# Keep experimental features off in production
FINANCE_EXPERIMENTAL_ENABLED=false
```

### Verify Flag State at Runtime

```typescript
import { resolveFinanceFlag, FINANCE_FLAGS } from '@nzila/finance-core/feature-flags'

const isEnabled = resolveFinanceFlag(FINANCE_FLAGS.FINANCE_LEDGER_ENABLED, process.env)
```

## Account Lifecycle Operations

### Create an Account

```typescript
import { createInMemoryAccountService } from '@nzila/finance-core/accounts'

const svc = createInMemoryAccountService()
const account = await svc.createAccount({
  orgId: 'org_abc',
  accountType: 'customer',
  ownerId: 'user_xyz',
  displayName: 'Jane Smith',
  currency: 'CAD',
})
```

### Suspend an Account (Compliance Hold)

```typescript
await svc.suspendAccount('org_abc', account.id)
```

Log the suspension via `@nzila/audit` AuditEngine immediately after.

### Archive an Account

```typescript
await svc.archiveAccount('org_abc', account.id)
```

Archival is irreversible in the default implementation. Ensure all open transactions are settled or cancelled first.

## Ledger Operations

### Post a Double-Entry Journal Batch

```typescript
import { createInMemoryJournalService } from '@nzila/finance-ledger/journal'
import { createInMemoryLedgerStore } from '@nzila/finance-ledger/ledger'

const journal = createInMemoryJournalService()
const store = createInMemoryLedgerStore()

// Open a batch
let batch = journal.openBatch('org_abc', 'user_xyz')

// Add a debit entry
batch = journal.addEntry(batch, {
  orgId: 'org_abc',
  accountId: 'acct_revenue',
  entryType: 'debit',
  amountCents: 10000, // $100.00 CAD
  currency: 'CAD',
  description: 'Subscription fee',
})

// Add the balancing credit entry
batch = journal.addEntry(batch, {
  orgId: 'org_abc',
  accountId: 'acct_receivable',
  entryType: 'credit',
  amountCents: 10000,
  currency: 'CAD',
  description: 'Subscription fee receivable',
})

// Post the batch — throws if unbalanced
const posted = journal.postBatch(batch)

// Append to the ledger store
for (const entry of posted.entries) {
  await store.appendEntry(entry)
}
```

### Reverse a Posted Batch

```typescript
import { reverseBatch } from '@nzila/finance-ledger/reversal'

const reversal = reverseBatch(posted, 'user_xyz_correcting_error')
// Post the reversal batch to the store...
```

### Run Reconciliation

```typescript
import { createReconciliationService } from '@nzila/finance-ledger/reconciliation'

const svc = createReconciliationService()
let run = svc.startReconciliation('org_abc', '2025-01-01', '2025-01-31', 'user_xyz')

// Pass external entries (from bank feed, Stripe, etc.)
const { matched, unmatched } = svc.matchEntries(run, externalEntries)

if (unmatched.length === 0) {
  run = svc.completeReconciliation(run)
} else {
  run = svc.disputeReconciliation(run, `${unmatched.length} unmatched entries`)
}
```

## Governance Operations

### Create an Approval Request

```typescript
import { createApprovalRequest, recordApproval } from '@nzila/finance-governance/approval'

const req = createApprovalRequest({
  orgId: 'org_abc',
  requestedBy: 'user_xyz',
  subject: 'transfer',
  subjectId: 'txn_001',
  amountCents: 500000,
  currency: 'CAD',
  threshold: 500000, // $5,000 CAD
  requiredApprovers: 2, // dual approval
})

// First approver
let updated = recordApproval(req, 'approver_1', 'Reviewed and approved')

// Second approver — triggers status: 'approved'
updated = recordApproval(updated, 'approver_2', 'Confirmed')
```

### Check Spending Controls Before a Transaction

```typescript
import { checkSpendingControl } from '@nzila/finance-governance/spending-controls'

const result = checkSpendingControl(control, amountCents)
if (!result.allowed) {
  throw new Error(`Transaction blocked: ${result.reason}`)
}
if (result.requiresDualApproval) {
  // Initiate dual approval workflow
}
```

## Compliance Operations

### Open a KYC Review

```typescript
import { createInMemoryKycService } from '@nzila/finance-compliance/kyc'

const kyc = createInMemoryKycService()
const review = kyc.openKycReview('org_abc', account.id)
```

KYC in Finance Core is a **placeholder**. Wiring to a real KYC provider (Onfido, Persona, etc.) is an app-layer integration concern.

### Check Risk Tier

```typescript
import { computeRiskTier } from '@nzila/finance-compliance/risk'

const tier = computeRiskTier([
  { name: 'transaction_volume', weight: 2, value: 0.6 },
  { name: 'account_age_days', weight: 1, value: 0.2 },
])
// Returns: 'low' | 'medium' | 'high' | 'critical'
```

## Analytics Operations

### Cashflow Summary

```typescript
import { summarizeCashflow } from '@nzila/finance-analytics/cashflow'

const summary = summarizeCashflow('org_abc', ledgerEntries, '2025-01-01', '2025-01-31')
```

### Aging Report

```typescript
import { buildAgingReport } from '@nzila/finance-analytics/aging'

const report = buildAgingReport('org_abc', outstandingItems, new Date())
// Returns buckets: 0-30, 31-60, 61-90, 90+
```

## Monitoring and Alerting

Finance Core emits typed events via `FinanceEventTypes`. Subscribe to these on your event bus:

```typescript
import { FinanceEventTypes } from '@nzila/finance-core/events'

bus.subscribe(FinanceEventTypes.TRANSACTION_FAILED, async (event) => {
  // Alert on-call, log to observability
})

bus.subscribe(FinanceEventTypes.COMPLIANCE_REVIEW_OPENED, async (event) => {
  // Notify compliance team
})
```

## Troubleshooting

### "Journal batch is unbalanced"

A `JournalBatch` was posted with `totalDebits !== totalCredits`. Every debit entry must have a corresponding credit entry of equal value. Review the entries added to the batch before calling `postBatch`.

### Feature flag not enabling

Check that the environment variable is set in the deployment environment. `resolveFinanceFlag` reads from `process.env` by default. Environment variables must be strings (`"true"` not `true`).

### Account update fails with wrong orgId

Finance Core enforces strict `orgId` scoping. Ensure the calling code passes the correct `orgId` matching the account's `orgId`. Cross-tenant operations are rejected.

### Idempotency key collision

`buildFinanceIdempotencyKey(orgId, operation, resourceId)` produces a deterministic key. If you see an unexpected collision, check that your `resourceId` is truly unique within the `orgId` + `operation` namespace (e.g., use UUIDs for transaction IDs).
