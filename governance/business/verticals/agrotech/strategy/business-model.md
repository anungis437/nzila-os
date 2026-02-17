# Agrotech Business Model & Unit Economics
> Revenue model, financial projections, and growth metrics for CORA + PonduOps under Nzila Corp.

---

## 1. Revenue Streams

### Primary Revenue
| Stream | Platform | % of Revenue (2030 target) | Description |
|---|---|---|---|
| SaaS Subscriptions | PonduOps + CORA | 55% | Monthly/annual cooperative and enterprise subscriptions |
| Marketplace Transaction Fees | CORA | 25% | 2-5% fee on CORA-facilitated commodity transactions |
| Data Licensing | Both | 10% | Anonymized agricultural data sold to NGOs, governments, researchers |
| Government Contracts | Both | 10% | Direct contracts for agricultural digitization programs |

### Secondary Revenue (2027+)
- **Input marketplace commission**: 3-8% on fertilizer/seed orders placed through PonduOps
- **Insurance premium share**: 10-15% referral fee on weather-indexed micro-insurance policies
- **Carbon credit facilitation**: 5% fee on carbon credits traded through CORA marketplace
- **Premium analytics**: $200-500/mo for enterprise-grade agricultural intelligence reports

---

## 2. Pricing Tiers — Detailed Breakdown

### Farmer Free Tier ($0/month)
**Target**: Individual smallholder farmers (entry point for cooperative acquisition)
- Basic crop calendar and planting reminders
- Market price alerts via SMS (3 commodities)
- Weather forecasts (7-day)
- Limited PonduOps: personal harvest log (max 5 fields)
- **Purpose**: Drive cooperative sign-ups through farmer demand; farmer approaches cooperative manager requesting full features

### Cooperative Standard ($50-100/month)
**Target**: Small cooperatives with 50-200 members
- Full PonduOps farm ERP for all members
- Basic CORA supply chain matching (10 listings/month)
- Cooperative financial management (ledger, contributions)
- 5 admin seats, offline sync for all members
- SMS notifications (500/month included)
- Monthly cooperative performance report
- **Expected adoption**: 400+ cooperatives by 2030

### Cooperative Pro ($100-200/month)
**Target**: Large cooperatives with 200-1,000 members
- Everything in Standard
- Unlimited CORA supply chain matchings
- Advanced analytics dashboard with yield benchmarking
- 15 admin seats, role-based access control
- Harvest quality grading and batch tracking
- Input marketplace access (bulk purchasing)
- Priority support (48-hour response SLA)
- **Expected adoption**: 200+ cooperatives by 2030

### Enterprise ($500-2,000/month)
**Target**: Agribusinesses, grain traders, exporters, large federations
- Full CORA API access with custom integrations
- White-label options for federation branding
- Dedicated account manager
- Custom reporting and data exports
- Multi-cooperative dashboard (federation view)
- SLA: 99.5% uptime, 4-hour critical response
- Onboarding and training package included
- **Expected adoption**: 30+ enterprise accounts by 2030

---

## 3. Unit Economics Deep Dive

### CORA Unit Economics
| Metric | Value | Notes |
|---|---|---|
| **Customer LTV** | $18,000 | 5-year lifespan × $300/mo avg revenue |
| **CAC** | $120 | Blended across cooperative federation + field agent channels |
| **LTV/CAC Ratio** | **150x** | Best-in-class; driven by low-cost cooperative channel |
| **Payback Period** | 0.4 months | CAC recovered in first subscription payment |
| **Monthly Churn** | 1.2% | Annual churn ~14%; cooperative lock-in reduces churn |
| **Gross Margin** | 82% | Low infrastructure cost per cooperative on Azure |
| **Net Revenue Retention** | 115% | Cooperatives expand usage (more members, higher tiers) |

### PonduOps Unit Economics
| Metric | Value | Notes |
|---|---|---|
| **Customer LTV** | $9,400 | 5-year lifespan × $157/mo avg revenue |
| **CAC** | $100 | Field agent onboarding + cooperative training |
| **LTV/CAC Ratio** | **94x** | Strong; offline-first stickiness reduces churn |
| **Payback Period** | 0.6 months | CAC recovered within first month |
| **Monthly Churn** | 1.5% | Annual churn ~17%; seasonal usage (planting/harvest spikes) |
| **Gross Margin** | 78% | Slightly lower due to SMS costs and offline sync infrastructure |
| **Net Revenue Retention** | 108% | Growth through member additions and tier upgrades |

### Why LTV/CAC Is Exceptionally High
1. **Cooperative channel multiplier**: Onboarding 1 cooperative leader acquires 50-500 farmers at near-zero incremental CAC
2. **Government subsidy stacking**: Agricultural development grants offset 30-50% of first-year costs
3. **Network effects**: Cooperatives recruit neighboring cooperatives organically
4. **Switching costs**: Offline data + cooperative governance features create deep lock-in
5. **Low infrastructure cost**: Django on Azure with PostgreSQL — lean, cost-efficient stack

---

## 4. Financial Projections (2025-2030)

| Year | Cooperatives | Farmers | ARR | MRR | Revenue Mix |
|---|---|---|---|---|---|
| 2025 | 12 | 1,500 | $85K | $7.1K | 90% SaaS / 10% transaction fees |
| 2026 | 45 | 8,000 | $210K | $17.5K | 80% SaaS / 15% transaction / 5% data |
| 2027 | 120 | 25,000 | $420K | $35K | 65% SaaS / 25% transaction / 10% data |
| 2028 | 250 | 55,000 | $650K | $54.2K | 55% SaaS / 30% transaction / 15% other |
| 2029 | 400 | 100,000 | $820K | $68.3K | 50% SaaS / 30% transaction / 20% other |
| 2030 | 700+ | 200,000+ | $980K | $81.7K | 55% SaaS / 25% transaction / 10% data / 10% govt |

### Key Assumptions
- Average cooperative size: 150-300 members, growing as cooperatives mature
- Cooperative-to-farmer ratio remains ~1:285 at scale
- Transaction fee revenue scales with marketplace GMV (targeting $20M GMV by 2030)
- Data licensing begins in 2026 once anonymized datasets reach statistical significance
- Government contracts land in 2028+ as DRC agricultural modernization programs deploy

---

## 5. Cost Structure

### Monthly Operating Costs (2026 Projection — 45 Cooperatives)

| Category | Monthly Cost | % of Revenue | Notes |
|---|---|---|---|
| Azure Infrastructure | $1,200 | 6.9% | App Services, PostgreSQL, Redis, CDN |
| SMS & Communications | $800 | 4.6% | SMS notifications, USSD gateway |
| Field Operations | $4,500 | 25.7% | 3 field agent teams (3 provinces) |
| Engineering Team | $6,000 | 34.3% | 4 developers (DRC-based), part-time CTO |
| Cooperative Onboarding | $1,500 | 8.6% | Training materials, travel, equipment |
| Support & Maintenance | $1,000 | 5.7% | Customer support, bug fixes |
| General & Admin | $1,500 | 8.6% | Legal, accounting, office |
| **Total** | **$16,500** | **94.3%** | |
| **Net Margin** | **$1,000** | **5.7%** | Approaching breakeven |

### Path to Profitability
- **2025**: Operating at loss (-$8K/month); funded by seed investment and grants
- **2026**: Near breakeven; field operations cost offset by cooperative revenue growth
- **2027**: Profitable at 15-20% net margin; marketplace transaction fees compound
- **2028+**: 25-35% net margin; platform costs scale sub-linearly with cooperative count

---

## 6. Funding Strategy

### Current Funding Sources
- **Nzila Corp internal**: Seed funding from holding company ($150K allocated)
- **Agricultural development grants**: USAID, GIZ, World Bank agricultural digitization ($50-250K range)
- **Impact investors**: AgFunder, Acumen, Mercy Corps Ventures — targeting $500K seed round

### Funding Roadmap
| Stage | Timeline | Target | Use of Funds |
|---|---|---|---|
| Pre-seed | 2024-2025 | $150K (internal) | MVP development, DRC pilot with 12 cooperatives |
| Seed | 2026 | $500K | Field team expansion, 45 cooperatives, East Africa prep |
| Series A | 2028 | $2-3M | Pan-African expansion, marketplace scale, enterprise sales |
| Series B | 2030 | $8-12M | Multi-country operations, platform convergence, data products |

### Grant Pipeline
- **USAID Feed the Future**: $100K technology-for-agriculture grant (application Q2 2025)
- **GIZ AgriFinance**: $75K digital cooperative management pilot (DRC-specific)
- **Bill & Melinda Gates Foundation**: $250K smallholder digital inclusion (2026 cycle)
- **AfDB TAAT**: $150K agricultural technology transfer program

---

## 7. Growth Metrics & KPIs

### North Star Metrics
| Metric | Definition | 2025 Target | 2030 Target |
|---|---|---|---|
| **Active Cooperatives** | Cooperatives with ≥1 admin login in last 30 days | 10 | 600+ |
| **Marketplace GMV** | Total value of CORA-facilitated transactions | $50K | $20M |
| **Farmer Activation Rate** | % of registered farmers who log ≥1 activity/month | 35% | 55% |

### Leading Indicators
- **Cooperative activation time**: Days from sign-up to first harvest logged (target: <30 days)
- **Member invitation rate**: Avg new members added per cooperative per month (target: 8+)
- **Supply listing conversion**: % of CORA listings that result in a transaction (target: >25%)
- **Offline sync frequency**: Avg syncs per cooperative per week (proxy for engagement; target: 5+)

### Cohort Analysis Framework
- Track cooperative cohorts by onboarding quarter
- Measure 3/6/12-month retention by cohort
- Monitor revenue expansion within cohorts (tier upgrades, member growth)
- Flag cooperatives with <2 syncs/week for proactive outreach
