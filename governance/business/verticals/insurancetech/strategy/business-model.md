# SentryIQ360 — Business Model & Unit Economics

## Revenue Model Overview

SentryIQ360 generates revenue through four complementary streams: SaaS subscriptions from broker agencies, per-quote transaction fees, carrier placement fees (override commissions), and data analytics licensing to carriers. This diversified model creates compounding value as broker volume and carrier coverage grow.

---

## Revenue Streams

### 1. SaaS Subscriptions (Primary — 55% of Revenue)
Monthly subscription fees from broker agencies, tiered by agency size and feature access.

| Tier | Monthly Price | Included Users | Carriers | Quotes/Month | Target Segment |
|------|--------------|----------------|----------|-------------|---------------|
| Solo Broker | $99/mo | 1 | 5 | 100 | Independent brokers, 1-person shops |
| Small Agency | $299/mo | 5 | 12 | 500 | 2-10 broker agencies |
| Enterprise Agency | $799/mo | Unlimited | 20+ | Unlimited | 10+ broker agencies, cluster groups |

- Annual contracts receive 15% discount (Solo: $84/mo, Small: $254/mo, Enterprise: $679/mo)
- Enterprise custom pricing available for 50+ broker clusters negotiated per-deal

### 2. Per-Quote Transaction Fees (20% of Revenue)
- $0.50 per personal lines quote (auto, home, tenant)
- $2.00 per commercial lines quote (BOP, CGL, commercial property)
- $5.00 per specialty lines quote (cyber, E&O, D&O)
- Included quota per tier; overage billed monthly
- Volume discounts: 10% off at 1,000+ quotes/mo, 20% off at 5,000+

### 3. Carrier Placement Fees (15% of Revenue)
- Override commissions from carriers for policies placed through SentryIQ360
- Typical override: 1-3% of first-year premium on policies bound via platform
- Carrier pays SentryIQ360 for aggregating broker demand and driving quote volume
- Non-conflicting: broker retains full commission — overrides come from carrier's acquisition budget
- Target: $50-150 per policy placed, depending on line and carrier

### 4. Data Analytics Licensing (10% of Revenue)
- Anonymized, aggregated market intelligence sold to carriers and reinsurers
- Products:
  - **Market Appetite Report**: Quote demand by geography, line, and risk segment — $5,000/quarter
  - **Conversion Analytics**: Win/loss rates by carrier, region, broker segment — $8,000/quarter
  - **Rate Competitiveness Index**: How carrier rates compare to market median — $12,000/quarter
- Strict anonymization: no broker or client PII shared; aggregate only
- PIPEDA-compliant data governance framework

---

## Unit Economics

### Broker-Level
| Metric | Value | Notes |
|--------|-------|-------|
| **LTV** | $14,400 | 36-month average retention × $400 ARPU |
| **CAC** | $200 | IBAO events, digital marketing, referral credits |
| **LTV/CAC Ratio** | 72x | Exceptional for SaaS; driven by low-touch digital acquisition |
| **ARPU** | $400/mo | Blended across tiers (weighted toward Small Agency) |
| **Payback Period** | < 1 month | CAC recovered in first monthly subscription payment |
| **Churn Rate** | 2.5%/mo (target) | ~30% annual; target < 15% by 2027 with full feature set |
| **Gross Margin** | 78% | Infrastructure + carrier API costs ≈ 22% of subscription revenue |

### Agency-Level Cohort Analysis
| Tier | % of Agencies | ARPU | LTV (36mo) | CAC | Contribution Margin |
|------|--------------|------|-----------|-----|-------------------|
| Solo Broker | 50% | $99 | $3,564 | $100 | 85% |
| Small Agency | 35% | $299 | $10,764 | $250 | 80% |
| Enterprise | 15% | $799 | $28,764 | $500 | 75% |

---

## Financial Projections (2025–2030)

### Revenue Ramp

| Year | Paying Agencies | Blended ARPU | Subscription ARR | Transaction Revenue | Placement Fees | Analytics | Total Revenue |
|------|----------------|-------------|-----------------|-------------------|---------------|-----------|--------------|
| 2025 | 10 | $250 | $30K | $5K | $2K | $0 | $37K |
| 2026 | 100 | $350 | $420K | $75K | $35K | $20K | $550K |
| 2027 | 200 | $400 | $960K | $180K | $95K | $60K | $1.3M |
| 2028 | 350 | $420 | $1.76M | $350K | $200K | $120K | $2.4M |
| 2030 | 500+ | $450 | $2.7M | $600K | $400K | $250K | $3.95M |

### SOM Target: $450K ARR milestone hit in mid-2026, scaling well beyond through 2030.

---

## Cost Structure

### Variable Costs (Scale with Revenue)
- **Carrier API maintenance**: $2,000-5,000/carrier/year for integration upkeep — $50K at 20 carriers
- **Cloud infrastructure**: Azure compute, database, storage — scales with quote volume — $3K-15K/mo
- **Payment processing**: Stripe fees at 2.9% + $0.30 per transaction — ~3% of subscription revenue
- **CSIO membership & compliance**: $10K-25K/year for standards participation and data feeds

### Fixed Costs
- **Engineering team**: 3-5 developers (Django, React, ML), estimated $350K-600K/year
- **Product & design**: 1-2 people, $120K-200K/year
- **Sales & marketing**: 1-2 people + IBAO/IBAC event budget, $100K-180K/year
- **Broker onboarding**: Customer success manager, $70K-100K/year
- **Compliance & legal**: Part-time regulatory counsel, privacy officer — $50K-80K/year
- **Office & admin**: Remote-first, minimal overhead — $25K-40K/year

### Unit Cost per Agency Served
| Cost Component | Monthly per Agency | Notes |
|---------------|-------------------|-------|
| Infrastructure | $18 | Azure compute, DB, storage allocated per agency |
| Carrier APIs | $25 | Maintenance cost spread across paying agencies |
| Support | $15 | Customer success time per agency |
| **Total COGS** | **$58** | **~15% of blended ARPU** |

---

## Carrier Economics

### Cost to Integrate a Carrier
- **Engineering**: 80-200 hours per carrier ($8K-20K at blended contractor rate)
- **Ongoing maintenance**: 5-10 hours/month for API changes, rate updates ($500-1K/mo)
- **CSIO standard carriers**: Lower integration cost (standardized format)
- **Custom API carriers**: Higher upfront, lower maintenance

### Value to Carriers
- Access to aggregated independent broker channel without individual broker relationship management
- Guaranteed quote volume: brokers using SentryIQ360 see carrier's rates on every comparison
- Conversion data: carriers know their win/loss rates and competitive positioning
- Reduced distribution cost: digital acquisition vs. traditional BDM field visits

### Break-Even Analysis per Carrier
- Integration cost: $15K average
- Override revenue per carrier (100 agencies, 50 placements/mo): ~$7.5K/mo
- Payback: 2 months per carrier integration at scale
- ROI: 6x annually at 100+ agency base

---

## Growth Metrics & KPIs

### Activation Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| Broker Activation Rate | % of signed agencies running first quote within 7 days | 80% |
| Carrier Utilization | Avg carriers used per broker out of available carriers | 8+ |
| Quotes per Broker/Month | Average monthly quote volume per active broker | 100+ |

### Revenue Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| Net Revenue Retention | Revenue from existing agencies year-over-year (upsells - churn) | 115%+ |
| Expansion Revenue | % of revenue from tier upgrades (Solo → Small → Enterprise) | 20% |
| Carrier Coverage Ratio | % of Canadian P&C market premium accessible through platform | 80% |

### Efficiency Metrics
| Metric | Definition | Target |
|--------|-----------|--------|
| Burn Multiple | Net burn ÷ net new ARR | < 1.5x |
| Magic Number | Net new ARR ÷ prior quarter S&M spend | > 1.0 |
| Rule of 40 | Revenue growth % + profit margin % | > 40 |

---

*Nzila Corp — SentryIQ360 Business Model v1.0 — Confidential*
