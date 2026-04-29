# Finance Controls Governance

## Purpose

This document defines the governance controls, boundaries, and compliance framework for the Nzila OS Finance Core capability layer.

## What Finance Core Is

Finance Core is an **enterprise software toolkit** providing financial data models, workflow primitives, and calculation utilities for the Nzila OS platform. It is a capability layer — not a licensed financial service, bank, payment institution, or regulated entity.

## Regulatory Disclaimer

> **Important**: Nzila OS Finance Core makes no claim of being a bank, payment institution, e-money issuer, or any other regulated financial entity. KYC, sanctions screening, and risk scoring capabilities are **placeholder hooks** for integration with licensed third-party providers. No production financial operation should rely solely on Finance Core compliance features without proper regulatory review and licensed provider integration.

## Capability Controls Matrix

| Capability | Default State | Enablement Condition | Notes |
|---|---|---|---|
| Account management | ON | `FINANCE_CORE_ENABLED=true` | Safe to enable; no regulatory risk |
| Ledger operations | ON | `FINANCE_LEDGER_ENABLED=true` | Internal bookkeeping only |
| Governance workflows | ON | `FINANCE_GOVERNANCE_ENABLED=true` | Approval routing only |
| Analytics | ON | `FINANCE_ANALYTICS_ENABLED=true` | Read-only summaries |
| Payment intents | OFF | Requires Stripe integration + compliance review | Must not be ON without payment provider |
| Payout execution | OFF | Requires compliance sign-off | High risk; keep OFF until fully reviewed |
| KYC/sanctions | OFF | Requires licensed KYC provider integration | Placeholder only; do not use in production alone |
| Dues/contributions | OFF | Requires cooperative structure review | Community feature; needs governance approval |
| Experimental | OFF | Never in production | Quarantine only |

## Approval Workflow Governance

### Spending Threshold Policy

Finance Core implements configurable spending controls per organisation:

- **Per-transaction limit**: Maximum single transaction value
- **Daily limit**: Maximum daily aggregate spend
- **Monthly limit**: Maximum monthly aggregate spend
- **Dual approval threshold**: Transactions above this value require two approvers

Default thresholds must be configured per-tenant by a platform administrator. No global defaults are hardcoded (by design — no magic numbers).

### Approval Escalation

```
Transaction ≤ threshold           → Auto-approve (or single approval if configured)
Transaction > threshold            → Single approval required
Transaction > dual_approval_threshold → Dual approval required
```

Approval expiry: Every `ApprovalRequest` supports an `expiresAt` timestamp. Expired requests must be recreated.

### Denial Policy

A single denial immediately moves an `ApprovalRequest` to `rejected` status. Denied requests cannot be reapproved — a new request must be created.

## Ledger Immutability Controls

Finance Core enforces:

1. **Append-only**: No update or delete operations on `LedgerEntry` records
2. **Double-entry balance**: Every `JournalBatch` must balance before posting
3. **Reversal-only corrections**: Errors are corrected by posting a reversal batch, not by modifying existing entries
4. **Batch status transitions**: `draft → posted → reversed` only; no backward transitions

## Community Fund Controls

Community funds and hardship disbursements are subject to:

1. All disbursements require an `ApprovalRequest` reference
2. Fund balances may not go below zero (disbursement validation is caller responsibility)
3. Treasury proposals require a voting period; execution requires proposal status `approved`
4. All fund operations must be logged via `@nzila/audit`

## KYC and Sanctions Governance

KYC and sanctions capabilities in Finance Core are **placeholder stubs**:

- `KycStatus` tracks state (`not_started`, `pending`, `under_review`, `approved`, `rejected`, `expired`)
- `SanctionsStatus` tracks screening state (`not_screened`, `clear`, `flagged`, `under_review`, `confirmed_match`)
- Real KYC decisions come from a licensed provider (Onfido, Persona, Jumio, etc.)
- Real sanctions screening comes from a licensed list provider (Dow Jones, Refinitiv, etc.)
- Finance Core only stores the outcome; it does not perform the screening

**Production checklist** before enabling `FINANCE_COMPLIANCE_ENABLED=true`:
- [ ] KYC provider integration wired and tested
- [ ] Sanctions list provider integrated
- [ ] Legal review of data residency for KYC documents
- [ ] Compliance team sign-off
- [ ] Data retention policy configured

## Risk Scoring Controls

Risk scoring (`computeRiskTier`) uses a weighted factor model. The factors and weights are configurable at the application layer. The tiers (`low`, `medium`, `high`, `critical`) are informational and must be interpreted in context by the calling application.

**Finance Core does not block transactions based on risk tier alone.** The calling application is responsible for enforcement logic.

## Audit Trail Requirements

All Finance Core state transitions must be logged to `@nzila/audit` by the calling application. Finance Core does not self-audit — this is a deliberate design choice to keep the package portable.

Required audit events per operation:

| Operation | Required Audit Fields |
|---|---|
| Account created | `orgId`, `accountId`, `actorId`, `action: 'finance.account.create'` |
| Account suspended | `orgId`, `accountId`, `actorId`, `action: 'finance.account.suspend'` |
| Ledger batch posted | `orgId`, `batchId`, `actorId`, `action: 'finance.ledger.post'` |
| Ledger batch reversed | `orgId`, `batchId`, `reversalBatchId`, `actorId`, `action: 'finance.ledger.reverse'` |
| Approval granted | `orgId`, `requestId`, `approverId`, `action: 'finance.approval.grant'` |
| Approval denied | `orgId`, `requestId`, `approverId`, `action: 'finance.approval.deny'` |
| Compliance review opened | `orgId`, `reviewId`, `subjectId`, `action: 'finance.compliance.open'` |
| Fund disbursement approved | `orgId`, `disbursementId`, `actorId`, `action: 'finance.fund.disburse'` |

## Data Governance

- All monetary amounts are stored as **integer cents** — no floating-point money
- All timestamps are **ISO 8601 UTC strings**
- All records carry `orgId` — no cross-tenant data access
- Currency codes follow **ISO 4217** (via `@nzila/fx`)
- No personally identifiable information (PII) is stored within Finance Core records except as referenced IDs

## Access Control

Finance Core does not implement its own authentication or authorisation. Callers are responsible for:

1. Verifying the calling user's identity via `@nzila/platform-auth`
2. Checking the user has the required role/permission before calling Finance Core services
3. Passing the correct `orgId` matching the authenticated user's organisation

**Principle of Least Privilege**: Finance admin permissions should be granted to the minimum set of users required to operate.

## Change Control

Changes to the Finance Core capability layer require:

1. Peer review by at least one other engineer
2. Updated tests covering the changed behaviour
3. No reduction in test coverage
4. Updated documentation if public interfaces change
5. Feature flags for any new capability that has regulatory risk

## Roadmap Items (Not Yet Implemented)

The following are identified future capabilities that are **not** implemented in this release:

- Database persistence adapters (currently in-memory only)
- Real-time balance streaming
- Multi-currency ledger entries (FX integration at ledger level)
- Open Banking / PSD2 integration hooks
- Automated reconciliation matching algorithms
- Regulatory reporting exports (FINTRAC, CRA T5/T4A, etc.)
- Cooperative share capital management
- Payroll primitives
