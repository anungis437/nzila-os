# Zonga — Royalty & Payout Trust Architecture

## Design Philosophy

Every cent flowing through Zonga must be **deterministic, auditable, and provable**.
The financial trust layer ensures that creators can verify exactly how their earnings
were computed, what fees were deducted, and when/how they were paid out.

---

## Computation Pipeline

```
Revenue Event
    │
    ▼
┌──────────────────┐
│  Royalty Engine   │  computeRoyalty()
│  (zonga-rights)   │  → Deterministic splits
│                   │  → Integer minor units
│                   │  → Hash-sealed result
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Payout Proof    │  generatePayoutProof()
│  (zonga-rights)   │  → Revenue breakdown
│                   │  → Links to computation hash
│                   │  → Integrity-verifiable
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Eligibility     │  checkPayoutEligibility()
│  (zonga-payments) │  → KYC, disputes, frozen
│                   │  → Minimum balance
│                   │  → Cooldown period
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Orchestrator    │  executePayout()
│  (zonga-payments) │  → Route resolution
│                   │  → Provider execution
│                   │  → Audit event at every step
└──────────────────┘
```

## Royalty Engine

**Module**: `packages/zonga-rights/src/royalty-engine.ts`

Key guarantees:
- **Integer arithmetic**: All amounts in minor units (cents). No floating-point currency math.
- **Stable output shape**: `RoyaltyComputationResult` has fixed fields regardless of revenue source.
- **Rounding fairness**: Remainder from integer division assigned to first rights holder.
- **Calculation versioning**: Every result tagged with `calculationVersion` (currently `1.0.0`).
- **Hash sealing**: SHA-256 hash of the full result, enabling tamper detection.
- **Fee categorisation**: Platform fees, processing fees, and tax withholding separated.

## Payout Proofs

**Module**: `packages/zonga-rights/src/payout-proof.ts`

Every payout generates a signed proof record:
- Revenue source breakdown (with amounts summing to total)
- Link back to royalty computation hash
- Proof hash for integrity verification
- Status tracking: `pending` → `disbursed` with provider reference
- `verifyProofIntegrity()` re-computes hash to detect tampering

## Payout Orchestrator

**Module**: `packages/zonga-payments/src/payout-orchestrator.ts`

Single execution path (no alternative code paths):
1. Check eligibility (account, KYC, disputes, balance, cooldown)
2. Resolve payment route (13 African providers)
3. Update status to `processing`
4. Execute via provider adapter
5. Emit audit event with full context
6. Return success/failure with details

Architecture: **Port-based dependency injection** — the orchestrator doesn't import
concrete implementations. All I/O goes through the `PayoutOrchestratorPorts` interface.

## Payout Eligibility

**Module**: `packages/zonga-payments/src/payout-eligibility.ts`

Six checks, all must pass:
1. Account is active
2. KYC status is verified
3. No active disputes
4. Payouts not frozen by compliance
5. Balance ≥ minimum ($1.00 / 100 minor units)
6. Cooldown elapsed (24 hours since last payout)

## Audit Trail

Every step in the payout flow emits an `PayoutAuditEvent`:
- `payout_initiated` — Request received
- `eligibility_checked` — Pass/fail with reasons
- `route_resolved` — Provider selected
- `provider_called` — Execution attempted
- `payout_completed` / `payout_failed` — Final status

Events contain: orgId, creatorId, payoutId, timestamp, status, and full metadata.
