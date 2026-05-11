# Zonga Billing & Payouts Readiness

> **Report type:** Launch readiness — billing and financial operations  
> **Generated:** 2025-Q2  
> **Scope:** Stripe Connect integration, royalty calculation, payout processing, and reconciliation

---

## Executive Summary

The Zonga billing and payouts stack is production-ready for pilot operations. Stripe Connect is wired with org-scoped accounts, royalty calculation is event-driven from streaming telemetry, and payout disbursement is gated by admin review before transfer.

---

## Billing Components

| Component | Status | Notes |
|-----------|--------|-------|
| Stripe Connect onboarding | ✅ Ready | Org-scoped connected accounts |
| Royalty calculation engine | ✅ Ready | Event-sourced from `zonga_analytics_events` |
| Monthly payout batch | ✅ Ready | Runs day-2 of calendar month |
| Payout approval workflow | ✅ Ready | Admin sign-off before Stripe transfer |
| Minimum threshold enforcement | ✅ Ready | $25 CAD rollover logic |
| Tax document generation | 🟡 Partial | T4A stub generation for CA partners; international TBD |

---

## Royalty Calculation Logic

1. Streaming events are written to `zonga_analytics_events` with `playback_*` event type
2. Monthly aggregation job groups events by `org_id`, `track_id`, `event_type`
3. Revenue allocation applies partner-specific revenue share rate (from `zonga_pilot_agreements`)
4. Net royalties are written to `zonga_royalty_ledger` with `status = pending_approval`
5. Admin approves payout batch → Stripe transfer initiated → status updated to `paid`

---

## Reconciliation Controls

- Every Stripe transfer is recorded with `stripe_transfer_id` in `zonga_royalty_ledger`
- Failed transfers retry up to 3 times with exponential backoff
- Reconciliation report available via `/api/admin/payouts/reconciliation`
- Audit trail stored in `zonga_payout_audit_log` with HMAC seal

---

## Open Items

| Item | Priority | Target |
|------|----------|--------|
| International tax doc generation | Medium | GA |
| Automated monthly reconciliation email to partners | Low | GA |
| Chargeback handling workflow | Medium | GA |

---

*Reviewed by: Nzila finance engineering team. Status: Approved for pilot operations.*
