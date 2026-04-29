# Finance Core Architecture

## Overview

The Nzila OS Finance Core is a native enterprise-grade financial capability layer built into the platform monorepo. It provides reusable, multi-tenant financial primitives across accounts, ledger, transactions, governance, compliance, analytics, and identity — ready to power products across the Nzila portfolio.

## Scope

Finance Core is a **capability layer**, not a standalone product. It provides building blocks consumed by apps and services within the monorepo.

### What is included

| Package | Responsibility |
|---|---|
| `@nzila/finance-core` | Foundation: types, schemas, accounts, feature flags, events, idempotency |
| `@nzila/finance-ledger` | Double-entry journal, append-only ledger, reversals, reconciliation |
| `@nzila/finance-compliance` | KYC, sanctions screening, risk scoring, consent records |
| `@nzila/finance-governance` | Approval workflows, spending controls, treasury proposals, community funds |
| `@nzila/finance-analytics` | Cashflow summaries, aging reports, cohort metrics, fee revenue |
| `@nzila/finance-identity` | Identity profiles linking compliance states to transaction eligibility |

### What is NOT included

- Production payment processing (use `@nzila/payments-stripe` for Stripe integration)
- FX conversion engine (use `@nzila/fx`)
- Database persistence layer (adapters are in-memory; persistence wiring is app-layer responsibility)
- Regulatory certification — this is a software toolkit, not a licensed financial service
- Custodial asset management
- Smart contract dependencies

## Architecture Principles

### Multi-Tenancy

Every record carries `orgId` for full tenant isolation. No cross-tenant data access is possible through the Finance Core APIs.

### Immutable Financial History

Ledger entries are append-only. The `LedgerStore` interface exposes no update or delete operations. Corrections are made through reversal batches, preserving the original entries.

### Double-Entry Compatibility

`@nzila/finance-ledger` enforces that every `JournalBatch` must have equal total debits and total credits before posting. Unbalanced batches throw synchronously.

### Idempotency

Transactions carry an `idempotencyKey`. The `buildFinanceIdempotencyKey` utility produces deterministic keys from `(orgId, operation, resourceId)` using SHA-256.

### Event-Driven Integration

Finance Core defines `FinanceEventTypes` for all significant state changes (account created, transaction settled, approval granted, etc.). Apps consume these events through `@nzila/platform-event-fabric`.

### Feature Flags

All Finance Core capability areas are gated behind feature flags. Risky features default to `false`. Flags are resolved from environment variables at runtime.

```
FINANCE_CORE_ENABLED          — master enable (default: true)
FINANCE_LEDGER_ENABLED        — ledger operations (default: true)
FINANCE_PAYMENTS_ENABLED      — payment intents (default: false)
FINANCE_PAYOUTS_ENABLED       — payout execution (default: false)
FINANCE_DUES_ENABLED          — dues/contributions (default: false)
FINANCE_GOVERNANCE_ENABLED    — approval workflows (default: true)
FINANCE_COMPLIANCE_ENABLED    — KYC/sanctions hooks (default: false)
FINANCE_ANALYTICS_ENABLED     — analytics summaries (default: true)
FINANCE_EXPERIMENTAL_ENABLED  — experimental features (default: false)
```

## Domain Model

### Core Types (finance-core)

```
FinanceAccount
  id, orgId, accountType, status, ownerId, displayName,
  currency, balanceCents, createdAt, updatedAt, metadata?

BalanceSnapshot
  id, orgId, accountId, balanceCents, currency, snapshotAt, runId

Transaction
  id, orgId, type, status, fromAccountId?, toAccountId?,
  amountCents, currency, description, idempotencyKey,
  createdAt, settledAt?, metadata?

PaymentIntent
  id, orgId, accountId, amountCents, currency, status,
  externalRef?, createdAt, expiresAt?, metadata?
```

### Ledger Types (finance-ledger)

```
LedgerEntry
  id, orgId, journalBatchId, accountId, entryType (debit|credit),
  amountCents, currency, description, createdAt, immutable: true

JournalBatch
  id, orgId, entries[], totalDebits, totalCredits, balanced,
  postedAt, createdBy, status (draft|posted|reversed), reversalBatchId?

ReconciliationRun
  id, orgId, periodStart, periodEnd, state, reconciledAt?,
  totalMatched, totalUnmatched, runBy
```

### Compliance Types (finance-compliance)

```
ComplianceReview
  id, orgId, subjectId, subjectType, reviewType,
  status, openedAt, resolvedAt?, reviewedBy?, notes?, riskTier?

ConsentRecord
  id, orgId, subjectId, purpose, granted, grantedAt,
  expiresAt?, revokedAt?, metadata?
```

### Governance Types (finance-governance)

```
ApprovalRequest
  id, orgId, requestedBy, subject, subjectId, amountCents?,
  threshold, requiredApprovers, approvals[], denials[], status,
  createdAt, resolvedAt?, expiresAt?

TreasuryProposal
  id, orgId, proposedBy, title, description, requestedAmountCents,
  currency, status, voteDeadline, createdAt, executedAt?

CommunityFund
  id, orgId, name, purpose, balanceCents, currency, createdBy,
  status, createdAt

SpendingControl
  id, orgId, dailyLimitCents, monthlyLimitCents,
  perTransactionLimitCents, requiresDualApprovalAboveCents, currency
```

## Package Dependency Graph

```
finance-analytics
  └── finance-core
  └── finance-ledger
        └── finance-core

finance-identity
  └── finance-compliance

finance-governance
  └── finance-core
```

No package in Finance Core depends on the apps layer. Dependency flows strictly downward.

## Integration Points

| Integration | Package | How |
|---|---|---|
| `@nzila/platform-auth` | Permission guards | App layer; Finance Core defines RBAC-ready interfaces |
| `@nzila/platform-event-fabric` | Events | Emit `FinanceEvent` via event bus at settlement/approval |
| `@nzila/payments-stripe` | Payment intents | App layer wires Stripe PaymentIntent to `finance-core` Transaction |
| `@nzila/fx` | Currency conversion | Pass `FxRate` into `amountCents` calculations |
| `@nzila/audit` | Audit trail | Record every state transition via AuditEngine |
| `@nzila/consent-engine` | Consent | Finance Compliance wraps consent records |
| `@nzila/platform-governance` | Workflows | Finance Governance extends governance approval patterns |
| `@nzila/platform-notifications` | Alerts | Emit finance events; notification layer subscribes |

## Status Lifecycle

All finance entities share a common status lifecycle:

```
pending → submitted → approved → settled
                   ↘ rejected
             → failed
             → reversed (post-settlement correction)
             → cancelled (pre-settlement abort)
             → suspended (compliance hold)
             → archived (end-of-life)
```

## Security Guardrails

- No claim of banking license or regulated financial service
- No custodial asset management
- No production smart-contract dependency
- All monetary values as integer cents (no floating-point money)
- No secrets in source code
- Encryption hooks available via `@nzila/security`
- Full audit trail via `@nzila/audit`
- Least privilege: permission checks are caller responsibility
- Risk flags and compliance states are informational hooks only
