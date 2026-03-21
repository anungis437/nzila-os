# Zonga — Proof Target Matrix

> Enumerates every critical path with invariants, failure modes, test types,
> diagnostics, and pass/fail criteria for the operational proof pass.

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Proven (test passes under adversarial conditions) |
| 🔲 | Not yet tested |

---

## ECO — Economic Engine Proofs

| ID | Invariant | Failure Mode | Test Type | Pass Criteria | Status |
|----|-----------|-------------|-----------|---------------|--------|
| ECO-1 | Ledger always balanced | High-volume ingestion creates imbalance | Property test (1 000 random txns) | `debits − credits < $0.001` for every txn | ✅ |
| ECO-2 | No revenue without ledger backing | Duplicate delivery storms | Stress + idempotency | Guard E1 blocks every un-backed event | ✅ |
| ECO-3 | Fee computation correctness | All 14 revenue sources × edge amounts | Exhaustive combinatorial | `gross − fees = net` for all inputs | ✅ |
| ECO-4 | Split accuracy | Splits always sum to 100% ± rounding | Property test (randomised shares) | `remainder < $0.01`, `Σ distributions = net` | ✅ |
| ECO-5 | Settlement reconciliation | Partial failure during batch | Failure injection | `processedCount + failedCount = total` | ✅ |
| ECO-6 | Payout reversal integrity | Reversal under retry | Idempotency replay | Reversed txn entries re-balance to zero | ✅ |

## RGT — Rights & Royalty Proofs

| ID | Invariant | Failure Mode | Test Type | Pass Criteria | Status |
|----|-----------|-------------|-----------|---------------|--------|
| RGT-1 | Splits per rights-type = 100% | Rounding across N holders | Property test | `validateSplits()` passes for all random configs | ✅ |
| RGT-2 | Dispute freezes payouts | File → freeze → no payout | Behavioural proof | `shouldFreezePayouts()` returns true while open | ✅ |
| RGT-3 | Dispute resolution unfreezes | Resolve → unfreeze | Lifecycle test | Payouts resume after resolution | ✅ |
| RGT-4 | Royalty computation determinism | Same input → same output | Determinism proof (100 runs) | All 100 results identical | ✅ |
| RGT-5 | Version history immutability | Amendment creates new version | Structural proof | Version chain monotonically increases | ✅ |
| RGT-6 | Signature lifecycle correctness | Sign / reject / duplicate | FSM exhaustive | All valid transitions succeed, invalid blocked | ✅ |

## TKT — Ticketing Proofs

| ID | Invariant | Failure Mode | Test Type | Pass Criteria | Status |
|----|-----------|-------------|-----------|---------------|--------|
| TKT-1 | No oversell (T1) | N concurrent purchases for last ticket | Concurrency simulation | Only 1 succeeds, `sold ≤ capacity` always | ✅ |
| TKT-2 | Atomic reservation (T2) | Race condition on capacity check | Concurrency proof | `guardAtomicReservation(0)` blocks losers | ✅ |
| TKT-3 | Refund eligibility windows | Boundary: 24h, 48h, event-start | Boundary value analysis | Correct refund % at each boundary | ✅ |
| TKT-4 | No duplicate scans (T4) | Two scanners scan same ticket | Race simulation | Second scan returns `ALREADY_SCANNED` | ✅ |
| TKT-5 | Offline scan conflict resolution | 3 devices scan offline | First-writer-wins proof | Earliest timestamp wins, others marked conflict | ✅ |
| TKT-6 | Transfer chain validation | Transfer → re-transfer → refund | Lifecycle proof | Ownership chain is traceable and valid | ✅ |
| TKT-7 | Event settlement accuracy | Mixed refunds + completed orders | End-to-end proof | `platformFees + promoter + artist = net` | ✅ |

## FLW — Flow / Control Plane Proofs

| ID | Invariant | Failure Mode | Test Type | Pass Criteria | Status |
|----|-----------|-------------|-----------|---------------|--------|
| FLW-1 | Workflow exclusivity | Same FSM ID registered twice | Structural audit | `registerWorkflow()` rejects duplicates | ✅ |
| FLW-2 | No orphan states | State unreachable from initial | Graph analysis (all 12 FSMs) | Every state reachable from initial | ✅ |
| FLW-3 | Terminal states are sinks | Terminal state has outgoing transition | Structural proof | Terminal states have zero transitions | ✅ |
| FLW-4 | Invariant checker completeness | Missing invariant for critical path | Coverage proof | `runAllInvariantChecks()` covers E1-E6, R1-R5, T1-T6, G1-G5 | ✅ |
| FLW-5 | Compensation correctness | Payout fails → compensate | Lifecycle proof | Compensation reverses all side effects | ✅ |

## GOV — Governance Proofs

| ID | Invariant | Failure Mode | Test Type | Pass Criteria | Status |
|----|-----------|-------------|-----------|---------------|--------|
| GOV-1 | Admin reason required (G1) | Empty reason on admin action | Guard proof | `guardAdminReasonRequired('')` fails | ✅ |
| GOV-2 | Role authorisation (G2) | Unprivileged user attempts admin op | Guard proof | `guardRoleAuthorization()` blocks | ✅ |
| GOV-3 | Rate limiting (G3) | Burst of same action | Threshold proof | Blocks after threshold exceeded | ✅ |
| GOV-4 | Audit completeness (G4) | Missing audit fields | Structural proof | All required audit fields present | ✅ |

---

## Proof Execution Order

1. **ECO-1 → ECO-6** — Economic engine (financial correctness is foundational)
2. **RGT-1 → RGT-6** — Rights & royalties (depends on economic engine)
3. **TKT-1 → TKT-7** — Ticketing (concurrency-critical)
4. **FLW-1 → FLW-5** — Flow / control plane (orchestration layer)
5. **GOV-1 → GOV-4** — Governance (policy enforcement)

---

*Generated by the Zonga Operational Proof Pass*
