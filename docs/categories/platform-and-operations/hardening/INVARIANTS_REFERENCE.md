# Zonga — Invariants Reference

All enforced business invariants, their guard functions, and where they are
checked in the runtime.

---

## Economic Invariants (E1–E6)

| ID | Name | Guard Function | Enforcement Point |
|----|------|---------------|-------------------|
| E1 | No revenue without ledger backing | `guardRevenueHasLedgerBacking()` | `revenue-actions.ts` — every `recordRevenueEvent` writes `ledger.revenue.entry` |
| E2 | Payout within available balance | `guardPayoutWithinBalance()` | `execute-payout.handler.ts` via `gatePayout()` |
| E3 | Ledger balanced (debits = credits) | `guardLedgerBalanced()` | On-demand — tolerance ±0.001 |
| E4 | No negative payout amount | `guardNoNegativePayout()` | Pre-execution guard pipeline |
| E5 | Transaction reversible | `guardTransactionReversible()` | Before compensation/rollback |
| E6 | Settlement reconciled | `guardSettlementReconciled()` | Post-settlement verification |

**Batch runner:** `runEconomicGuards(input)` — runs E1–E6, returns first failure or `{ ok: true }`.

---

## Rights & Royalty Invariants (R1–R5)

| ID | Name | Guard Function | Enforcement Point |
|----|------|---------------|-------------------|
| R1 | Splits sum to 100% | `guardSplitsSum100()` | Before rights update commit |
| R2 | No payout on disputed release | `guardNoPayoutOnDisputedRelease()` | `execute-payout.handler.ts` via `gatePayout()` |
| R3 | Splits have valid creators | `guardSplitsHaveValidCreators()` | Before rights update commit |
| R4 | Dispute resolution unfreezes payouts | `guardDisputeResolutionUnfreezes()` | `resolveRightsDispute()` — checks remaining disputes |
| R5 | Sync license has rights holder | `guardSyncLicenseHasRightsHolder()` | Before license sync |

---

## Ticketing Invariants (T1–T6)

| ID | Name | Guard Function | Enforcement Point |
|----|------|---------------|-------------------|
| T1 | No oversell | `guardNoOversell()` | Atomic INSERT…SELECT in `purchaseTicket()` |
| T2 | Atomic reservation | `guardAtomicReservation()` | Database-level — single INSERT…SELECT statement |
| T3 | Refund eligibility | `guardRefundEligibility()` | 24h default cutoff, configurable |
| T4 | No duplicate scan | `guardNoDuplicateScan()` | Blocks `used`, `cancelled`, `refunded` tickets |
| T5 | Event not cancelled | `guardEventNotCancelled()` | Blocks purchases on `cancelled`/`completed` events |
| T6 | Transfer ownership | `guardTransferOwnership()` | Validates owner match + `confirmed` status |

---

## Governance & Security Invariants (G1–G5)

| ID | Name | Guard Function | Enforcement Point |
|----|------|---------------|-------------------|
| G1 | Admin action requires reason | `guardAdminActionReason()` | `resolve-moderation-case.handler.ts` — min 10 chars |
| G2 | Role authorization | `guardRoleAuthorization()` | Pre-execution guard pipeline |
| G3 | Rate limiting | `guardRateLimit()` | Pre-execution guard pipeline |
| G4 | Audit completeness | `guardAuditCompleteness()` | Post-command verification |
| G5 | Environment restriction | `guardEnvironmentRestriction()` | Blocks dangerous ops in production |

---

## Test Coverage

- **84 unit tests** across 4 guard test files validate all 22 guards
- **20 structural hardening tests** validate enforcement hooks in source files
- **153 workflow invariant tests** validate all 12 FSM state machines
