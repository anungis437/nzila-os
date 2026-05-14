# Zonga — Billing / Payouts Readiness Report

**Sprint**: Client Launch Readiness | **Date**: 2026-04-19

---

## Executive Summary

Zonga has a well-architected earnings and payout subsystem. The core ledger, revenue split logic, and Stripe Connect wiring are present. M-Pesa (Vodacom) is feature-flagged and operational. The payout flow requires **manual approval** — there is no automated scheduled disbursement. For a first client launch, this is a **safe posture**: founder reviews and approves all payouts before execution.

**Launch Mode**: **Hybrid / Manual Settlement Mode** — fully supportable at launch.

---

## 1. Billing Architecture Summary

### Payment Rails

| Rail | Status | Notes |
|---|---|---|
| Stripe Checkout (subscriptions) | ✅ Implemented | `createCheckoutSession` in `lib/stripe.ts` |
| Stripe webhooks | ✅ Implemented | `verifyWebhookSignature`, `normalizeAndPersist` |
| Stripe Connect (creator payouts) | ✅ Implemented | `executeCreatorPayout` in `lib/stripe.ts` |
| Vodacom M-Pesa | ✅ Feature-flagged | `ZONGA_ENABLE_VODACOM_MPESA=true` to activate; supports TZ/MZ/LS/CD |
| Manual / bank transfer | ❌ Not automated | Must be done outside system; record as manual ledger entry |

### African Currency Support

Stripe handles: `usd`, `cad`, `eur`, `gbp`, `ngn`, `kes`, `zar`, `ghs`, `egp`, `mad`, `tzs`, `ugx`, `rwf`, `xof`, `xaf`.

Fallback-to-USD: `etb`, `cdf`, `bwp`, `zmw`.

---

## 2. Payout Lifecycle Map

```
Creator earns (streaming/ticket/tip)
        ↓
recordEarnings() → zonga_earnings_entries
  • Gross amount
  • Platform fee deducted (source-specific %)
  • Net amount credited to creator
  • Revenue split rules applied if multi-party content
        ↓
Creator requests payout (requestPayout())
  • Minimum threshold enforced (currency-specific)
  • Available balance checked
  • Record inserted: status = 'requested'
        ↓
Finance admin approves (transitionPayoutState → 'approved')
  • Role check: finance_admin only (hardened in this sprint)
        ↓
System processes (transitionPayoutState → 'processing')
  • Stripe Connect transfer OR M-Pesa push
  • Stripe transfer_id stored
        ↓
Completion: 'completed' or 'failed'
  • Failure reason recorded
  • Creator notified (notification action)
```

### Platform Fee Schedule

| Revenue Source | Platform Fee |
|---|---|
| Streaming | 30% |
| Download | 25% |
| Ticket sale | 15% |
| Subscription share | 20% |
| Tip | 10% |

---

## 3. Supported vs Unsupported Commercial Flows

| Flow | Status | Notes |
|---|---|---|
| Listener subscriptions (monthly) | ✅ Supported | Stripe Checkout, free + premium tiers ($4.99/mo) |
| Creator subscriptions (monthly) | ✅ Supported | Starter (free) → Enterprise (custom) |
| One-time purchases / downloads | ✅ Supported | Download purchase in creator plans |
| Event ticketing | ✅ Supported | `ticket-service.ts`, `event-lifecycle.ts`, capacity enforcement |
| Creator payouts (Stripe Connect) | ✅ Supported | Manual approval step required |
| Creator payouts (M-Pesa) | ✅ Supported | Feature-flagged, env vars required |
| Revenue splits (multi-artist) | ✅ Supported | `revenue-split.ts`, split rules in DB |
| Promo codes / discounts | ❌ Not implemented | Gap — defer to post-launch |
| Platform commissions | ✅ Supported | Computed automatically in earnings ledger |
| Refunds | ⚠️ Partial | Stripe refunds possible via Stripe dashboard; no automated refund API in Zonga |
| Failed payment handling | ✅ Supported | Stripe webhooks handle `payment_intent.payment_failed` |
| Reconciliation | ✅ Supported | `matchPayoutsToDeposits`, `generateExceptions`, `computeCloseReadiness` |
| Payout ledger visibility | ✅ Supported | `getEarningsBalance`, payout history API (now role-gated) |
| Invoice / receipt generation | ❌ Not implemented | Gap — Stripe can issue receipts via customer portal |
| Tax handling | ⚠️ Not automated | Stripe Tax not configured; no VAT/WHT computation; creator responsible |

---

## 4. Launch-Safe Fallback Policy

### Manual Settlement Mode (Recommended for First Client)

For the first 30–60 days of client operation:

1. **All payouts require manual finance_admin approval** before processing. This is the current system behaviour — no change required.
2. A **weekly payout review** should be scheduled: finance_admin exports payout queue, verifies against Stripe balance, approves batch.
3. **Stripe Connect account** must be established for each creator receiving payouts before their first payout is approved.
4. **Minimum payout thresholds** are enforced in code (currency-specific). Do not bypass.
5. **Refund policy**: Issue refunds directly from Stripe Dashboard until the automated refund API is built. Log each refund manually in the audit trail.

### Payout Approval Workflow (Operational Runbook)

```
Weekly (every Monday):
1. Finance admin logs in → navigates to /admin/payouts
2. Reviews pending payout requests
3. Verifies creator Stripe Connect account is active
4. Clicks "Approve" → system moves to 'processing' → Stripe transfer executes
5. Reviews 'failed' payouts → contacts creator to update payout details
6. Downloads payout report (export) for accounting
```

### Manual Payout Report Export

The system can export payout data via the `GET /api/payouts` endpoint (role-gated). For accounting:

```bash
# Export current payout queue (run as finance_admin session)
curl -X GET "/api/payouts?page=1" \
  -H "Cookie: nzila_session=<token>" \
  > payout-export-$(date +%Y-%m-%d).json
```

---

## 5. Gaps and Risks

| Gap | Severity | Launch Blocker? | Mitigation |
|---|---|---|---|
| No automated refund API | 🟠 HIGH | No — use Stripe Dashboard | Document in operator runbook |
| No promo/discount codes | 🟡 MEDIUM | No | Defer to post-launch sprint |
| No invoice/receipt generation | 🟡 MEDIUM | No | Stripe sends receipts by default on checkout |
| Tax computation not automated | 🟡 MEDIUM | No | Founder takes responsibility; add counsel guidance |
| Creator must have Stripe Connect account before payout | 🟠 HIGH | No — system blocks invalid payouts | Onboarding checklist must include Stripe Connect setup |
| Reconciliation reports are code-level, not UI | 🟡 MEDIUM | No | Admin can run via API |

---

## 6. Conclusion

**Launch Mode**: **Hybrid / Manual Settlement Mode**

Zonga can launch with real monetization. The payout pipeline is sound. Manual approval is a feature, not a bug, for a first client deployment — it prevents accidental over-disbursement. Automated scheduled payouts and a refund UI are appropriate for the second operational sprint.

---

*Generated by Nzila OS Automation — Zonga Client Launch Readiness Sprint*
