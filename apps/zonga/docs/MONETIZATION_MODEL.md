# Zonga — Monetization Model

## Overview

Zonga operates a multi-sided marketplace connecting African music creators
with listeners, event organisers, and rights holders. Revenue is generated
through platform commissions, subscription fees, and value-added services.

All prices are in **integer minor units** (cents USD) throughout the codebase.

---

## Listener Plans

| Plan | Monthly Price | Key Features |
|------|--------------|--------------|
| **Free** | $0 | Ad-supported streaming, playlists (10 max), tipping, event discovery |
| **Premium** | $4.99 | Ad-free, offline downloads (10k tracks), Hi-Fi lossless, exclusive releases |

## Creator Plans

| Plan | Monthly Price | Target Audience | Key Differentiators |
|------|--------------|-----------------|---------------------|
| **Starter** | $0 | Independent artists | 5 uploads/mo, 1 team member, 3 split parties, 2 events/mo |
| **Pro Creator** | $29 | Serious creators | 50 uploads/mo, 3 team members, 10 split parties, 10 events/mo, AI assist, reduced fees |
| **Business** | $149 | Labels & organisers | Unlimited uploads/events, 10 team members, 50 split parties, API access, dedicated manager |
| **Enterprise** | Custom | Major labels & distributors | Unlimited everything, negotiable fees, white-label, SLA guarantees, on-premise option |

## Fee Schedule

### Platform Commissions (Default / Pro Creator / Business)

| Revenue Source | Default | Pro Creator | Business |
|---------------|---------|-------------|----------|
| Streaming | 15% | 12% | 10% |
| Ticket sales | 7.5% | 6% | 5% |
| Tips | 10% | 8% | 5% |
| Downloads | 12% | 12% | 10% |
| Sync licensing | 15% | 15% | 15% |
| Merchandise | 10% | 10% | 10% |
| Subscriptions | 12% | 12% | 12% |

### Payment Processing

| Method | Rate |
|--------|------|
| Mobile Money (Africa) | 1.5% + $0.10 |
| Card (international) | 2.9% + $0.30 |

### Event Economics

- Default platform fee: **7.5%** of ticket revenue
- Premium model (high-volume): **5%** of ticket revenue
- Processing: **1.5% + $0.10** per ticket
- Default event splits: Platform 7.5% / Promoter 32.5% / Artist 60%
- Refund policy: Full refund 48h before event, 50% refund 24h before, no refund after

## Payout Rules

- Minimum payout: **$1.00** (100 minor units)
- Cooldown: **24 hours** between payouts
- Eligibility checks: Active account, KYC verified, no disputes, not frozen
- 13 African payment provider routes supported
- Hash-sealed payout proofs for audit trail

## Revenue Growth Levers

1. **Subscription upgrades** — Free → Premium, Starter → Pro Creator
2. **Event volume** — Each event generates ticket fees + streaming uplift
3. **Creator tools** — AI-powered growth strategies drive more content → more streams
4. **Geographic expansion** — Each new African market adds mobile money integration revenue
5. **Enterprise deals** — Custom pricing for major labels with guaranteed volume

## Design Principles

- **Africa-first pricing**: Lower flat fees for affordable markets
- **Creator-friendly rates**: 85% creator take on streaming (vs. industry 50-70%)
- **Config-driven**: Rates stored as data, not hardcoded — volume-tiered overrides per org
- **Deterministic financials**: Integer arithmetic, hash-sealed computation, full audit trail
- **Transparent splits**: All fee breakdowns visible to creators in dashboard
