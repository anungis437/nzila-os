# Zonga

> Africa-first music distribution, streaming, and royalty management platform.

## Stack

- **Framework:** Next.js 16 (App Router + Turbopack)
- **Auth:** `@nzila/platform-auth` (email/password + optional Entra SSO)
- **UI:** `@nzila/ui` + Tailwind CSS + Framer Motion
- **Monitoring:** Sentry
- **Port:** 3011 (dev) / 3006 (production)

## Quick Start

```bash
pnpm dev:zonga   # or: cd apps/zonga && pnpm dev
```

Copy `.env.example` → `.env.local` and fill required values:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET` | NextAuth session secret |
| `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` | Entra SSO |
| `STRIPE_SECRET_KEY` | Payments & payouts (optional) |
| `BLOB_CONNECTION_STRING` | Azure Blob for audio storage (optional) |

## Key Docs

- [docs/AFRICA_FIRST_COMMERCIAL_MODEL.md](docs/AFRICA_FIRST_COMMERCIAL_MODEL.md) — commercial strategy
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) — domain model reference
- [docs/MONETIZATION_MODEL.md](docs/MONETIZATION_MODEL.md) — monetization & pricing
- [docs/ROYALTY_AND_PAYOUT_TRUST.md](docs/ROYALTY_AND_PAYOUT_TRUST.md) — royalty distribution
- [docs/ZONGA-END-TO-END-WORKFLOW.md](docs/ZONGA-END-TO-END-WORKFLOW.md) — full workflow guide
- [docs/GOVERNANCE_POLICY.md](docs/GOVERNANCE_POLICY.md) — content governance
- [docs/PILOT_DEMO_GUIDE.md](docs/PILOT_DEMO_GUIDE.md) — demo walkthrough

## Key Packages

- `@nzila/zonga-core` / `@nzila/zonga-control-plane` — domain logic & control plane
- `@nzila/zonga-intelligence` — ML-powered recommendations
- `@nzila/zonga-payments` / `@nzila/payments-stripe` — payment processing
- `@nzila/ai-sdk` / `@nzila/ml-sdk` — AI features

## Domain

Music industry platform covering artist onboarding, track/release management, catalog browsing, playlist curation, podcast hosting, royalty calculation & payout, subscription management, content moderation, and analytics — built for the African music ecosystem.

---

## Zonga Launch Mode

**Status**: ⚠️ GO WITH RESTRICTIONS — controlled single-client commercial deployment

Zonga has completed its Client Launch Readiness Sprint and is cleared for a first revenue-generating client under the following restrictions:

| Restriction | Reason |
|---|---|
| Single client only | Founder-operated; multi-client after Sprint A |
| Manual payout approval | Finance admin reviews weekly; no auto-disbursement |
| Live streaming disabled | Pending IVS configuration and testing |
| Max 500 tracks / 100 concurrent listeners | Load tested after first 90 days |
| Invite-only creator registration | Open sign-up after user management UI ships |
| Legal docs require counsel sign-off | Drafts prepared; not yet published |
| 14-day founder hypercare | Elevated support SLA for first client |

### Pre-Launch Blockers (6 items)

> Before flipping to production, resolve these in `reports/zonga-go-live-decision.md` → Section 3.

### Report Index

| Report | Location |
|---|---|
| Master Launch Readiness | [reports/zonga-launch-readiness.md](../../reports/zonga-launch-readiness.md) |
| Auth / RBAC Audit | [reports/zonga-auth-rbac-audit.md](../../reports/zonga-auth-rbac-audit.md) |
| Billing / Payouts Readiness | [reports/zonga-billing-payouts-readiness.md](../../reports/zonga-billing-payouts-readiness.md) |
| Upload / Streaming Readiness | [reports/zonga-streaming-readiness.md](../../reports/zonga-streaming-readiness.md) |
| Admin Panel Gap Audit | [reports/zonga-admin-gap-audit.md](../../reports/zonga-admin-gap-audit.md) |
| Legal Launch Pack | [reports/zonga-legal-launch-pack.md](../../reports/zonga-legal-launch-pack.md) |
| Backup & IR Plan | [reports/zonga-backup-ir-plan.md](../../reports/zonga-backup-ir-plan.md) |
| Client Onboarding Script | [reports/zonga-client-onboarding-script.md](../../reports/zonga-client-onboarding-script.md) |
| Go-Live Decision | [reports/zonga-go-live-decision.md](../../reports/zonga-go-live-decision.md) |

### Launch Day

Run the checklist in `reports/zonga-client-onboarding-script.md` Section 2 (Configuration Checklist) and Section 4 (Launch Call Script).
