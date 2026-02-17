# EdTech-Cybersecurity — Business Model

> Revenue model, unit economics, and financial projections for CyberLearn cybersecurity training platform.

---

## Revenue Model

### Primary Revenue Stream — SaaS Subscriptions (80%)

#### MSP Partner Pricing
| Tier | Price | Seats | Features |
|---|---|---|---|
| **MSP Starter** | $2.00/user/mo | Up to 250 | Training library, basic reporting, 1 org |
| **MSP Growth** | $1.50/user/mo | 251-1,000 | + Phishing sim, multi-org, white-label |
| **MSP Enterprise** | $1.00/user/mo | 1,001+ | + Custom content, API, priority support |
| **MSP NFR** | Free | Up to 50 | Internal MSP staff use only |

#### Direct SMB Pricing
| Tier | Price | Seats | Features |
|---|---|---|---|
| **Essential** | $4.00/user/mo | Up to 50 | Core training, certificates, basic reporting |
| **Professional** | $3.50/user/mo | 51-200 | + Phishing sim, compliance frameworks |
| **Business** | $3.00/user/mo | 201-500 | + Dark web monitoring, exec reporting |

### Secondary Revenue Streams

#### Custom Content Development (10%)
- Custom course creation for MSPs/enterprises: $2,000-5,000 per course
- Industry-specific content packs: $500/pack (one-time or per-org licensing)
- White-label content licensing: $1,000-3,000/year per MSP

#### Certification Program (5%)
- CyberLearn Certified Security Aware Professional (CCSAP): $99/exam
- Annual recertification: $49/year
- Bulk pricing: $49/exam for 50+ seats

#### Professional Services (5%)
- Implementation & onboarding: $500-2,000 per organization
- Security culture assessment: $1,500 per engagement
- Phishing campaign consulting: $300/campaign setup

---

## Unit Economics

### MSP Partner Economics
```
Average MSP Partner:
├── Clients managed: 5 organizations
├── Avg users per org: 40
├── Total users: 200
├── Revenue per user: $1.75/mo (blended)
├── Monthly revenue per MSP: $350
├── Annual revenue per MSP: $4,200
│
├── Cost to acquire (CAC): $500
│   ├── Conference/event cost: $200
│   ├── Sales cycle (2 months): $250
│   └── Onboarding: $50
│
├── Annual COGS per MSP: $420 (10%)
│   ├── Infrastructure: $150
│   ├── Support: $170
│   └── Content licensing: $100
│
├── Gross profit per MSP: $3,780/year
├── LTV (24-month avg retention): $7,560
├── LTV/CAC: 15.1x
└── Payback period: 1.4 months
```

### Direct SMB Economics
```
Average SMB Client:
├── Users: 75
├── Revenue per user: $3.75/mo (blended)
├── Monthly revenue: $281
├── Annual revenue: $3,375
│
├── Cost to acquire (CAC): $300
│   ├── Insurance broker referral fee: $150
│   ├── Sales cycle (1 month): $100
│   └── Onboarding: $50
│
├── Annual COGS: $338 (10%)
├── Gross profit: $3,037/year
├── LTV (24-month retention): $6,074
├── LTV/CAC: 20.2x
└── Payback period: 1.1 months
```

---

## Cost Structure

### Fixed Costs (Monthly)
| Category | Year 1 | Year 3 | Year 5 |
|---|---|---|---|
| Engineering (2 → 6 FTE) | $8,000 | $30,000 | $60,000 |
| Content production (1 → 3 FTE) | $3,000 | $12,000 | $25,000 |
| Azure infrastructure | $500 | $5,000 | $20,000 |
| Sales & marketing | $2,000 | $10,000 | $25,000 |
| Support (0.5 → 2 FTE) | $1,500 | $6,000 | $12,000 |
| Office/admin | $500 | $2,000 | $5,000 |
| **Total Fixed** | **$15,500** | **$65,000** | **$147,000** |

### Variable Costs (Per Unit)
| Category | Cost | Notes |
|---|---|---|
| Hosting per user | $0.15/mo | Azure compute + storage |
| Email delivery (phishing sim) | $0.001/email | SendGrid volume pricing |
| Video streaming | $0.02/GB | Azure CDN |
| Support per ticket | $5 | Blended (chat + email) |
| Content licensing | $0.05/user/mo | Third-party content royalties |

### Gross Margin Analysis
- **Year 1**: 78% (high fixed costs relative to revenue)
- **Year 3**: 85% (scale efficiencies)
- **Year 5**: 88% (content amortization, infrastructure optimization)

---

## Financial Projections

### Revenue Forecast
| Year | MSP Partners | SMB Direct | Total Users | MRR | Annual Revenue |
|---|---|---|---|---|---|
| 2025 | 15 | 10 | 1,500 | $8K | $96K |
| 2026 | 50 | 40 | 8,000 | $35K | $420K |
| 2027 | 120 | 100 | 25,000 | $100K | $1.2M |
| 2028 | 250 | 200 | 60,000 | $220K | $2.6M |
| 2029 | 400 | 350 | 100,000 | $350K | $4.2M |
| 2030 | 600 | 500 | 160,000 | $500K | $6M |

### Burn Rate & Path to Profitability
| Year | Revenue | Total Costs | Net | Cumulative |
|---|---|---|---|---|
| 2025 | $96K | $200K | -$104K | -$104K |
| 2026 | $420K | $600K | -$180K | -$284K |
| 2027 | $1.2M | $1.0M | +$200K | -$84K |
| 2028 | $2.6M | $2.0M | +$600K | +$516K |

**Breakeven**: Late 2027 (monthly), early 2028 (cumulative)

### Funding Requirements
- **Self-funded / bootstrap**: $100K (2025 — MVP + first MSPs)
- **Seed** (optional, 2026): $300K for content production + sales team
- Total to breakeven: ~$300K

---

## Channel Economics

### MSP Channel (Primary)
```
MSP Channel Funnel:
Conference Lead → Demo → Pilot (3 months free) → Paid Contract
     1,000          100        30                     15
     
Conversion: 1.5% conference-to-paid
Avg deal size: $4,200/year
Sales cycle: 60-90 days
```

### Insurance Broker Channel
```
Insurance Referral Funnel:
Broker Referral → Demo → Trial (30 days) → Paid
     200            80       40              20
     
Conversion: 10% referral-to-paid
Avg deal size: $3,375/year
Referral fee: $150 per converted client
```

### Revenue Mix by Channel
| Channel | Year 1 | Year 3 | Year 5 |
|---|---|---|---|
| MSP partners | 55% | 50% | 45% |
| Direct SMB | 25% | 30% | 30% |
| Custom content | 10% | 10% | 10% |
| Certifications & services | 10% | 10% | 15% |

---

## Competitive Pricing Position

### Price Comparison (Per User/Month)
| Platform | SMB Price | MSP Price | Notes |
|---|---|---|---|
| **KnowBe4** | $1.50-3.00 | $1.00-2.00 | Market leader, massive library |
| **Proofpoint SAT** | $2.00-4.00 | N/A | Enterprise only |
| **Ninjio** | $3.00-5.00 | $2.00-3.00 | Video-focused |
| **Beauceron** | $2.00-3.50 | $1.50-2.50 | Canadian, bilingual |
| **CyberLearn** | $3.00-4.00 | $1.00-2.00 | Canadian, MSP-first, labs |

### Price Positioning
- **vs KnowBe4**: Comparable MSP pricing, differentiated on Canadian content + labs
- **vs Beauceron**: Similar market but CyberLearn adds hands-on labs + phishing sim
- **vs Ninjio**: 30-40% cheaper, more interactive (labs vs passive video)

---

## Key Business Metrics

### North Star Metrics
- **MSP partners under contract** (leading indicator of user growth)
- **Course completion rate** (engagement = retention)
- **Phishing click rate reduction** (demonstrable ROI for buyers)

### Operational KPIs
| Metric | Year 1 | Year 3 | Year 5 |
|---|---|---|---|
| MSP partners | 15 | 120 | 400 |
| End-users | 1,500 | 25,000 | 100,000 |
| Completion rate | 75% | 82% | 88% |
| Phishing click rate reduction | 60% | 70% | 80% |
| Churn (monthly) | 5% | 3% | 2% |
| NRR (net revenue retention) | 100% | 115% | 125% |
| NPS | 40 | 55 | 65 |
| Courses in library | 20 | 100 | 250 |
