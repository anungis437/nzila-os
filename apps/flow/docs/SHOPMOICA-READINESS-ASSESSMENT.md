# ShopMoiCa Readiness Assessment

> Production readiness evaluation for Shop Quoter as the end-to-end operational system for ShopMoiCa.ca.

## Assessment Summary

| Area | Status | Notes |
|------|--------|-------|
| Quote Lifecycle | ✅ Complete | 13 statuses, enforced state machine, full transitions |
| Client Approval Portal | ✅ Complete | Secure share links, accept/revision, SHA-256 tokens |
| Payment/Deposit Gating | ✅ Complete | Deposit requirement, payment recording, PO blocking |
| PO Generation | ✅ Complete | Readiness check → order + PO creation from quote |
| Production → Shipping | ✅ Complete | Gated transitions with audit trail |
| Communication Templates | ✅ Complete | 6 templates covering full lifecycle |
| E2E Tests | ✅ Complete | 6 scenarios covering smoke, auth, portal, payment |
| Demo Data | ✅ Complete | 7 quotes across all statuses, 5 customers, timelines |
| Audit & Evidence | ✅ Complete | 16 audit event types, timeline, evidence packs |
| Policy Enforcement | ✅ Complete | PO/production gates, payment policy blocks |
| Quebec Tax Compliance | ✅ Complete | GST 5% + QST 9.975% via @nzila/pricing-engine |
| Zoho Integration | ✅ Complete | CRM, Books, Inventory sync (existing) |

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Shop Quoter (Next.js)                     │
├──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ Schemas  │ State    │ Services │ Actions  │ UI              │
│ (Zod)    │ Machine  │          │ (server) │ (React)         │
├──────────┼──────────┼──────────┼──────────┼─────────────────┤
│workflow- │quote-    │payment-  │send-     │quote-detail-    │
│schemas   │state-    │gating    │quote     │actions          │
│          │machine   │share-link│payment   │approval-form    │
│          │          │approval  │          │client portal    │
│          │          │quote-to- │          │                 │
│          │          │po        │          │                 │
│          │          │production│          │                 │
│          │          │-gating   │          │                 │
│          │          │workflow- │          │                 │
│          │          │audit     │          │                 │
├──────────┴──────────┴──────────┴──────────┴─────────────────┤
│              @nzila/* Platform Packages                      │
│  commerce-state · commerce-audit · commerce-observability    │
│  pricing-engine · platform-policy-engine · db (Drizzle)     │
└─────────────────────────────────────────────────────────────┘
```

## Quote Lifecycle Flow

```text
DRAFT → INTERNAL_REVIEW → SENT_TO_CLIENT → ACCEPTED
                 ↑              │                │
                 │         REVISION_REQUESTED    │
                 │              │           ┌────┴─────┐
                 └──────────────┘    DEPOSIT_REQUIRED  READY_FOR_PO
                                          │                │
                                     READY_FOR_PO    IN_PRODUCTION
                                                          │
                                                       SHIPPED
                                                          │
                                                      DELIVERED
                                                          │
                                                       CLOSED

Side exits: EXPIRED, CANCELLED (from DRAFT/SENT_TO_CLIENT)
```

## Security Controls

| Control | Implementation |
|---------|---------------|
| Authentication | Clerk (@clerk/nextjs) — all dashboard routes |
| Share Links | SHA-256 hashed tokens, 32-byte random, time-limited |
| Input Validation | Zod schemas at all boundaries |
| IP Tracking | Client IP hashed in approval records |
| CSRF | Next.js built-in protection |
| Rate Limiting | API guard middleware |

## Known Limitations

1. **In-memory repositories**: Workflow repos use in-memory stores.
   Replace with Drizzle-backed tables for persistence across restarts.
2. **Email delivery**: Communication templates generate content but
   don't send emails. Integrate with a provider for production.
3. **Zoho sync**: Workflow status changes don't automatically sync
   to Zoho. Add webhooks or polling for real-time sync.
4. **Multi-tenant isolation**: Demo data is org-scoped but in-memory
   stores don't enforce tenant isolation.

## Deployment Checklist

- [ ] Replace in-memory repos with Drizzle-backed tables
- [ ] Configure email provider for communication templates
- [ ] Set `NEXT_PUBLIC_APP_URL` environment variable for share link URLs
- [ ] Verify Clerk auth in production environment
- [ ] Run `pnpm lint && pnpm typecheck` — zero errors
- [ ] Run E2E tests against staging
- [ ] Load demo seed for UAT
- [ ] Confirm Zoho integration credentials
