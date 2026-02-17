# Fintech Business Model & Unit Economics

## Overview

Nzila Corp's fintech vertical generates revenue through two platforms — **DiasporaCore V2/C3UO** (community banking, remittances, tontines) and **STSA** (stock trading simulation & analytics). The model combines transaction-based revenue (remittance fees, FX spreads) with recurring SaaS revenue (credit union licensing, premium subscriptions) to build a diversified, high-margin financial services business targeting $600K SOM by 2030.

---

## Revenue Streams

### 1. Remittance Transaction Fees (DiasporaCore) — 45% of Revenue

| Corridor | Fee Rate | Competitor Avg | Volume Target (2028) |
|----------|----------|---------------|---------------------|
| Canada → DRC | 2.5% | 5-8% | $2M/month |
| Canada → Nigeria | 1.8% | 3-5% | $2.5M/month |
| US → Ghana | 2.0% | 3-6% | $1.5M/month |
| UK → Kenya | 1.5% | 2-4% | $1M/month |
| France → Senegal | 2.0% | 4-7% | $1M/month |

**Pricing Philosophy**: Undercut traditional providers (Western Union, MoneyGram at 5-10%) and match or slightly exceed digital competitors (Wise at 0.5-2%) by offering bundled value — remittances + tontines + community banking justify a small premium over pure remittance players.

### 2. FX Spread Revenue — 15% of Revenue

- **Spread**: 0.3-0.8% over mid-market rate (vs. Wise at 0.3-0.6%, banks at 2-4%)
- **Corridor-Dependent Pricing**: Liquid corridors (CAD→NGN) at 0.3%, illiquid corridors (CAD→CDF) at 0.8%
- **Hedging Strategy**: Forward contracts on high-volume corridors to lock margins, spot conversion on low-volume corridors
- **Monthly FX Revenue at Scale**: $8M monthly volume × 0.5% avg spread = $40K/month

### 3. SaaS Licensing — Credit Union Platform (DiasporaCore) — 20% of Revenue

| Plan | Monthly Fee | Included Members | Overage |
|------|------------|-----------------|---------|
| Starter | $500/mo | Up to 500 members | $1/member/mo |
| Growth | $1,500/mo | Up to 2,000 members | $0.75/member/mo |
| Enterprise | $3,500/mo | Up to 10,000 members | $0.50/member/mo |
| Custom | Negotiated | Unlimited | Custom |

- **Target**: 10 credit unions by 2027, 25 by 2030
- **Features Included**: White-label branding, member management, tontine tools, micro-lending engine, compliance reporting, dedicated support
- **Upsells**: Custom integrations ($5K one-time), premium analytics ($200/mo), API access ($300/mo)

### 4. Premium Subscriptions (STSA) — 10% of Revenue

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Paper trading (5 portfolios), basic market data (15-min delay), Trading Academy basics |
| Pro | $9.99/mo | Real-time data, unlimited portfolios, advanced analytics, social trading, African exchange access |
| Elite | $24.99/mo | Options simulator, robo-advisor, API access, priority support, tax optimization tools |

- **Conversion Target**: 15% free→Pro, 5% Pro→Elite
- **STSA ARPU**: $4.50/user/month blended across all tiers

### 5. Interest on Float — 5% of Revenue

- **Float Sources**: Funds in transit during remittance processing (avg. 24-48 hours), tontine pool balances awaiting payout, group savings pool balances
- **Yield**: Invested in high-yield savings accounts and short-term government bonds (4-5% annual yield at current rates)
- **Projected Float Balance at Scale**: $500K average balance → $25K annual interest income
- **Regulatory Note**: Float interest is permissible under Canadian MSB regulations; must be segregated in trust accounts

### 6. Micro-Lending Interest — 5% of Revenue

- **Loan Products**: Tontine advances (borrow against future payout), emergency micro-loans ($50-$500), group-backed loans
- **Interest Rate**: 1-3% per month (12-36% APR) — competitive vs. payday lenders (300-500% APR) but sustainable
- **Default Mitigation**: Social collateral (tontine group reputation), auto-deduction from future tontine payouts, credit score impact

---

## Unit Economics Deep Dive

### DiasporaCore — Per User

| Metric | Value | Notes |
|--------|-------|-------|
| Lifetime Value (LTV) | $3,600 | 5-year lifetime, $60/month avg. revenue per user |
| Customer Acquisition Cost (CAC) | $45 | Blended across community ambassadors, digital, partnerships |
| LTV:CAC Ratio | **80:1** | Exceptional — driven by low CAC through community networks |
| Monthly Revenue Per User | $60 | $40 remittance fees + $10 FX spread + $5 float + $5 lending |
| Monthly Cost to Serve | $8 | $3 payment processing + $2 infrastructure + $2 support + $1 compliance |
| Gross Margin Per User | **87%** | |
| Payback Period | **< 1 month** | CAC recovered in first remittance transaction |

### STSA — Per User

| Metric | Value | Notes |
|--------|-------|-------|
| Lifetime Value (LTV) | $1,200 | 4-year lifetime, $25/month avg. revenue (premium blend) |
| Customer Acquisition Cost (CAC) | $30 | Cross-sell from DiasporaCore ($10) + organic ($50) blended |
| LTV:CAC Ratio | **40:1** | Strong, boosted by DiasporaCore cross-sell funnel |
| Monthly Revenue Per User | $25 | Subscription + API fees |
| Monthly Cost to Serve | $6 | $3 market data APIs + $2 infrastructure + $1 support |
| Gross Margin Per User | **76%** | |
| Payback Period | **< 2 months** | |

---

## Financial Projections (2025–2030)

| Year | Users | Monthly Volume | Annual Revenue | Gross Margin | EBITDA |
|------|-------|---------------|---------------|-------------|--------|
| 2025 | 500 | $50K | $36K | 72% | -$120K |
| 2026 | 3,000 | $500K | $180K | 78% | -$60K |
| 2027 | 10,000 | $2M | $360K | 82% | $50K |
| 2028 | 25,000 | $8M | $600K | 85% | $180K |
| 2029 | 40,000 | $15M | $1.2M | 86% | $450K |
| 2030 | 60,000 | $25M | $2.4M | 87% | $960K |

### Path to Profitability

- **Break-even**: Q3 2027 at ~8,000 users and $1.5M monthly remittance volume
- **Key Lever**: Credit union SaaS contracts provide predictable MRR that covers fixed costs
- **Scale Economics**: Payment processing and compliance costs have significant economies of scale — compliance team can handle 10x volume without proportional headcount increase

---

## Cost Structure

### Fixed Costs (Monthly at 2026 Scale)

| Category | Monthly Cost | Notes |
|----------|-------------|-------|
| Engineering team (4 FTE) | $28K | 2 backend, 1 frontend, 1 DevOps |
| Compliance officer (1 FTE) | $6K | FINTRAC reporting, KYC oversight |
| Customer support (2 FTE) | $8K | Bilingual English/French |
| Infrastructure (AWS/Supabase) | $3K | Scales with usage |
| Compliance tools | $2K | ComplyAdvantage, Stripe Identity |
| Office & admin | $2K | Remote-first, minimal overhead |
| **Total Fixed** | **$49K/mo** | |

### Variable Costs (Per Transaction)

| Cost | Rate | Notes |
|------|------|-------|
| Payment processing (Stripe/Interac) | 0.5-1.5% | Varies by method |
| Disbursement partner (Flutterwave/Thunes) | 0.3-0.8% | Corridor-dependent |
| FX hedging cost | 0.1-0.2% | Forward contract premiums |
| Fraud screening | $0.05/transaction | ComplyAdvantage per-check pricing |
| SMS notifications (Twilio) | $0.02/message | 3-5 messages per remittance |

---

## Funding Strategy

### Seed Round — $500K (Q2 2025)

- **Sources**: Diaspora angel investors ($200K), government grants (IRAP, SRED — $150K), fintech accelerator (Y Combinator, Techstars — $150K)
- **Use of Funds**: MVP completion, first 3 corridors, FINTRAC MSB registration, initial team (4 people)

### Series A — $3M (Q4 2026)

- **Target Investors**: Fintech-focused VCs (Portage Ventures, Real Ventures, Panache Ventures — Canadian focus)
- **Valuation Target**: $15M pre-money (5x forward revenue multiple)
- **Use of Funds**: US/UK expansion, 5 additional corridors, credit union platform launch, team scale to 15

### Series B — $10M (Q4 2028)

- **Target Investors**: Cross-border fintech specialists (Quona Capital, TLcom Capital — Africa-focused)
- **Valuation Target**: $60M pre-money
- **Use of Funds**: EU expansion, banking license exploration, AI/ML compliance engine, team scale to 40

---

## Key Financial Metrics to Track

| Metric | Target | Frequency |
|--------|--------|-----------|
| Monthly Recurring Revenue (MRR) | Growth >15% MoM (early stage) | Monthly |
| Gross Transaction Volume (GTV) | >$500K/mo by Q4 2026 | Monthly |
| Net Revenue Retention | >120% | Quarterly |
| CAC Payback Period | <2 months | Quarterly |
| Gross Margin | >80% | Monthly |
| Remittance Completion Rate | >98% | Weekly |
| Default Rate (micro-lending) | <5% | Monthly |
| Cash Runway | >18 months | Monthly |
